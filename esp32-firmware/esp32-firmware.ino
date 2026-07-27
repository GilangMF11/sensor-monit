#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"

DHT dht(DHTPIN, DHTTYPE);

float temperature = 0;
float humidity = 0;
int co_ppm = 0;
int lpg_ppm = 0;

String apiToken = "";

unsigned long lastSensorRead = 0;
unsigned long lastApiCall = 0;
unsigned long lastWifiCheck = 0;

bool timeSynced = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=== Server Room Monitoring System ===");

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  dht.begin();
  delay(2000);

  connectToWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
    waitForNTPSync();
    loginToAPI();
  }

  activateBuzzer(1);
}

void loop() {
  if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    checkAlerts();
    lastSensorRead = millis();
  }

  if (millis() - lastApiCall >= API_SEND_INTERVAL) {
    sendToAPI();
    lastApiCall = millis();
  }

  if (millis() - lastWifiCheck >= 30000) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi lost, reconnecting...");
      connectToWiFi();
    }
    lastWifiCheck = millis();
  }

  delay(100);
}

void connectToWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);

  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi Connection Failed!");
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

void waitForNTPSync() {
  Serial.print("Waiting for NTP sync");
  int retries = 0;
  while (!timeSynced && retries < 20) {
    time_t now = time(nullptr);
    if (now > 1700000000) {
      timeSynced = true;
      Serial.println(" OK");
      struct tm timeinfo;
      localtime_r(&now, &timeinfo);
      Serial.printf("Time: %04d-%02d-%02d %02d:%02d:%02d\n",
                    timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
      return;
    }
    delay(500);
    Serial.print(".");
    retries++;
  }
  Serial.println(" NTP timeout, timestamps may be wrong");
}

void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (!isnan(t)) temperature = t;
  if (!isnan(h)) humidity = h;

  int adcValue = analogRead(MQ9_AOUT);
  co_ppm = map(adcValue, 0, 4095, 0, 1000);

  int digitalValue = digitalRead(MQ9_DOUT);
  lpg_ppm = digitalValue ? 100 : 0;

  Serial.printf("Temp: %.1fC | Hum: %.1f%% | CO: %d ppm | LPG: %d ppm\n",
                temperature, humidity, co_ppm, lpg_ppm);
}

void checkAlerts() {
  if (temperature > TEMP_CRITICAL) {
    activateBuzzer(3);
  } else if (temperature > TEMP_WARNING) {
    activateBuzzer(1);
  }

  if (co_ppm > CO_CRITICAL) {
    activateBuzzer(4);
  } else if (co_ppm > CO_WARNING) {
    activateBuzzer(2);
  }
}

void activateBuzzer(int beeps) {
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < beeps - 1) delay(100);
  }
}

String getISOTimestamp() {
  if (!timeSynced) return "";
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void sendToAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping API call");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["co_ppm"] = co_ppm;
  doc["lpg_ppm"] = lpg_ppm;

  String ts = getISOTimestamp();
  if (ts.length() > 0) {
    doc["timestamp"] = ts;
  }

  String jsonString;
  serializeJson(doc, jsonString);

  String url = String(API_SERVER) + API_PATH + "/sensor-data";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Requested-With", "XMLHttpRequest");
  http.addHeader("Authorization", String("Bearer ") + apiToken);

  int httpCode = http.POST(jsonString);

  if (httpCode == 201) {
    Serial.println("Data sent OK");
  } else if (httpCode == 401) {
    Serial.println("Token expired, re-login...");
    loginToAPI();
  } else {
    Serial.printf("API Error: %d\n", httpCode);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.println(response);
    }
  }

  http.end();
}
