#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <ArduinoJson.h>
#include <time.h>
#include <LiquidCrystal_I2C.h>
#include "../config.h"

DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

unsigned long lastRead = 0;
unsigned long lastDisplaySwitch = 0;
int displayPage = 0;
int lastHttpCode = 0;
bool timeSynced = false;
String apiToken = "";
float R0 = 833.0;
float smoothCO = 0;
const float EMA_ALPHA = 0.2;

void calibrateMQ2() {
  Serial.println("Calibrating MQ-2 in clean air...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibrating MQ2");
  lcd.setCursor(0, 1);
  lcd.print("Wait 10s...");

  pinMode(MQ2_AOUT, INPUT);
  delay(100);

  float sum = 0;
  const int samples = 50;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(MQ2_AOUT);
    delay(100);
  }
  float avgRaw = sum / samples;
  float voltage = avgRaw * (3.3 / 4095.0);
  float rs = ((3.3 * 10.0) / voltage) - 10.0;
  R0 = rs / 9.8;

  Serial.printf("MQ-2 cal: avg raw=%.0f, voltage=%.3fV, R0=%.2f\n", avgRaw, voltage, R0);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("MQ2 Calibrated");
  lcd.setCursor(0, 1);
  char buf[17];
  snprintf(buf, sizeof(buf), "R0=%.0f raw=%.0f", R0, avgRaw);
  lcd.print(buf);
  delay(2000);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);

  Serial.println("\n=== DHT22 + MQ-2 Sensor Test ===");
  Serial.printf("API: %s%s/sensor-data\n", API_SERVER, API_PATH);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  dht.begin();
  delay(2000);

  calibrateMQ2();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Server Room Mon");
  lcd.setCursor(0, 1);
  lcd.print("WiFi...");

  connectToWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
    syncTime();
    loginToAPI();
  }
}

void loop() {
  if (millis() - lastRead >= SENSOR_READ_INTERVAL) {
    lastRead = millis();
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temp) || isnan(humidity)) {
      Serial.println("ERROR: DHT22 not responding!");
      return;
    }

    int mq2Raw = analogRead(MQ2_AOUT);
    float coPpm = readMQ2CO(mq2Raw);
    if (isnan(coPpm) || isinf(coPpm)) coPpm = 0;
    if (coPpm > 10000) coPpm = 10000;
    if (isnan(smoothCO)) smoothCO = 0;
    smoothCO = (smoothCO == 0) ? coPpm : EMA_ALPHA * coPpm + (1 - EMA_ALPHA) * smoothCO;
    bool mq2Digital = !digitalRead(MQ2_DOUT);

    Serial.printf("Temp: %.1f C | Hum: %.1f %% | MQ2 raw: %d | CO: %.0f ppm | Alarm: %d\n",
      temp, humidity, mq2Raw, smoothCO, mq2Digital);

    lcd.clear();
    lcd.setCursor(0, 0);
    char buf[17];
    snprintf(buf, sizeof(buf), "T:%.1fC H:%.1f%%", temp, humidity);
    lcd.print(buf);
    lcd.setCursor(0, 1);
    if (displayPage == 0) {
      if (smoothCO >= CO_CRITICAL) snprintf(buf, sizeof(buf), "CO:%.0f CRIT!", smoothCO);
      else if (smoothCO >= CO_WARNING) snprintf(buf, sizeof(buf), "CO:%.0f WARN!", smoothCO);
      else snprintf(buf, sizeof(buf), "CO:%.0f OK", smoothCO);
      lcd.print(buf);
    } else {
      snprintf(buf, sizeof(buf), "W:%s HTTP:%d",
        WiFi.status() == WL_CONNECTED ? "OK" : "DOWN",
        lastHttpCode);
      lcd.print(buf);
    }

    if (WiFi.status() == WL_CONNECTED) {
      sendSensorData(temp, humidity, smoothCO);
    } else {
      Serial.println("WiFi down, skipping send");
      connectToWiFi();
    }
  }

  if (millis() - lastDisplaySwitch >= 3000) {
    lastDisplaySwitch = millis();
    displayPage = (displayPage + 1) % 2;
  }

  delay(100);
}

void connectToWiFi() {
  Serial.printf("Connecting to: %s\n", WIFI_SSID);

  WiFi.disconnect(true);
  delay(100);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFi.setAutoReconnect(true);
    Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi FAILED");
    lcd.setCursor(0, 1);
    lcd.print("Check SSID/PW");
  }
}

bool loginToAPI() {
  HTTPClient http;
  String url = String(API_SERVER) + API_PATH + "/auth/login";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Requested-With", "XMLHttpRequest");

  String body = "{\"email\":\"" + String(LOGIN_EMAIL) + "\",\"password\":\"" + String(LOGIN_PASSWORD) + "\"}";
  int httpCode = http.POST(body);

  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, response);
    if (!err && doc["success"]) {
      apiToken = doc["token"].as<String>();
      Serial.println("Login OK, token stored");
      http.end();
      return true;
    }
  }

  Serial.printf("Login failed: %d\n", httpCode);
  http.end();
  return false;
}

void syncTime() {
  Serial.print("NTP sync");
  int retries = 0;
  while (!timeSynced && retries < 20) {
    time_t now = time(nullptr);
    if (now > 1700000000) {
      timeSynced = true;
      struct tm ti;
      localtime_r(&now, &ti);
      Serial.printf(" OK  %04d-%02d-%02d %02d:%02d:%02d\n",
        ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
      return;
    }
    delay(500);
    Serial.print(".");
    retries++;
  }
  Serial.println(" timeout");
}

String getISOTimestamp() {
  if (!timeSynced) return "";
  time_t now = time(nullptr);
  struct tm ti;
  gmtime_r(&now, &ti);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
  return String(buf);
}

void sendSensorData(float temp, float humidity, float coPpm) {
  StaticJsonDocument<200> doc;
  doc["temperature"] = temp;
  doc["humidity"] = humidity;
  doc["co_ppm"] = round(coPpm);
  doc["lpg_ppm"] = 0;

  String ts = getISOTimestamp();
  if (ts.length() > 0) {
    doc["timestamp"] = ts;
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(String(API_SERVER) + API_PATH + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Requested-With", "XMLHttpRequest");
  http.addHeader("Authorization", String("Bearer ") + apiToken);

  int code = http.POST(body);
  lastHttpCode = code;
  if (code == 401) {
    Serial.println("Token expired, re-login...");
    loginToAPI();
  } else {
    Serial.printf("HTTP %d %s\n", code, code == 201 ? "OK" : http.getString().c_str());
  }
  http.end();
}

float readMQ2CO(int raw) {
  if (raw < 50) return 0;
  float voltage = raw * (3.3 / 4095.0);
  float rs = ((3.3 * 10.0) / voltage) - 10.0;
  float ratio = rs / R0;
  if (ratio <= 0) return 0;
  return 677.4 * pow(ratio, -3.399);
}
