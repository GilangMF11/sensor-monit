#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <HTTPClient.h>

WebServer server(80);
Preferences prefs;

struct Credentials {
  char ssid[33] = {0};
  char pass[65] = {0};
  char portalUser[33] = {0};
  char portalPass[33] = {0};
};

Credentials creds;
unsigned long lastPortalCheck = 0;

void loadCredentials() {
  prefs.begin("wifi", true);
  prefs.getString("ssid", creds.ssid, 33);
  prefs.getString("pass", creds.pass, 65);
  prefs.getString("puser", creds.portalUser, 33);
  prefs.getString("ppass", creds.portalPass, 33);
  prefs.end();
}

void saveCredentials() {
  prefs.begin("wifi", false);
  prefs.putString("ssid", creds.ssid);
  prefs.putString("pass", creds.pass);
  prefs.putString("puser", creds.portalUser);
  prefs.putString("ppass", creds.portalPass);
  prefs.end();
}

const char* configPage() {
  return R"rawliteral(
<!DOCTYPE html>
<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>WiFi Setup</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#eee;margin:0;padding:20px}h1{color:#00d2ff}label{display:block;margin:12px 0 4px;color:#a0a0b0}input{width:100%;padding:10px;background:#16213e;border:1px solid #0f3460;border-radius:6px;color:#eee;font-size:16px;box-sizing:border-box}button{width:100%;padding:14px;margin-top:20px;background:#00d2ff;color:#1a1a2e;border:none;border-radius:6px;font-size:18px;font-weight:bold;cursor:pointer}details{margin-top:16px;background:#16213e;border-radius:6px;padding:12px}summary{color:#00d2ff;cursor:pointer}</style></head><body>
<h1>Configure WiFi</h1>
<form method='POST' action='/save'>
<label>WiFi SSID</label><input name='ssid' maxlength='32' required>
<label>WiFi Password</label><input name='pass' type='password' maxlength='63'>
<details><summary>Captive Portal Login (optional)</summary>
<label>Portal Username</label><input name='puser' maxlength='32' placeholder='e.g. student ID'>
<label>Portal Password</label><input name='ppass' type='password' maxlength='32' placeholder='e.g. date of birth'>
<p style='font-size:13px;color:#888'>ESP32 will auto-detect portal and POST to it.<br>Only works with simple HTTP form-based portals.</p>
</details>
<button type='submit'>Save & Connect</button>
</form></body></html>
)rawliteral";
}

bool detectCaptivePortal() {
  HTTPClient http;
  http.begin("http://neverssl.com");
  http.setTimeout(5000);
  int code = http.GET();
  if (code == 0) { http.end(); return false; }

  bool captive = false;
  if (code >= 300 && code < 400) {
    String location = http.header("Location");
    Serial.printf("Portal redirect: %s\n", location.c_str());
    captive = true;
  } else if (code == 200) {
    String body = http.getString();
    if (body.indexOf("neverssl") == -1 && body.indexOf("portal") != -1) {
      captive = true;
    }
  }
  http.end();
  return captive;
}

bool loginToPortal(String portalURL) {
  if (strlen(creds.portalUser) == 0) {
    Serial.println("No portal credentials configured, manual login required");
    return false;
  }

  HTTPClient http;
  http.begin(portalURL);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);

  String payload = "user=" + String(creds.portalUser) +
                   "&pass=" + String(creds.portalPass) +
                   "&button=Login";
  int code = http.POST(payload);
  Serial.printf("Portal login: HTTP %d\n", code);
  http.end();
  return code == 200;
}

void startConfigAP() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  const char* apSSID = "ESP32-Config";
  WiFi.softAP(apSSID);
  Serial.printf("Config AP: %s (connect and go to http://%s)\n", apSSID, WiFi.softAPIP().toString().c_str());

  server.on("/", [  { server.send(200, "text/html", configPage()); });
  server.on("/save", [  {
    strncpy(creds.ssid, server.arg("ssid").c_str(), 32);
    strncpy(creds.pass, server.arg("pass").c_str(), 63);
    strncpy(creds.portalUser, server.arg("puser").c_str(), 32);
    strncpy(creds.portalPass, server.arg("ppass").c_str(), 32);
    saveCredentials();
    server.send(200, "text/html", "<h2>Saved. Restarting...</h2><script>setTimeout(function(){fetch('/').catch(function(){})},3000)</script>");
    delay(1000);
    ESP.restart();
  });
  server.begin();

  while (true) {
    server.handleClient();
    delay(10);
  }
}

bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(creds.ssid, creds.pass);

  Serial.printf("Connecting to %s", creds.ssid);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" failed");
    return false;
  }

  Serial.printf(" connected. IP: %s\n", WiFi.localIP().toString().c_str());

  if (detectCaptivePortal()) {
    Serial.println("Captive portal detected");
    if (!loginToPortal("")) {
      Serial.println("Portal login failed or not configured");
      return true;
    }
    delay(3000);
    if (!detectCaptivePortal()) {
      Serial.println("Portal login successful");
    }
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  loadCredentials();

  if (strlen(creds.ssid) == 0) {
    Serial.println("No WiFi configured, starting config AP...");
    startConfigAP();
  }

  if (!connectToWiFi()) {
    Serial.println("Connection failed, starting config AP...");
    startConfigAP();
  }

  Serial.println("WiFi ready, internet accessible");
}

void loop() {
  delay(10000);
  Serial.println("still alive");
}
