# PRD: ESP32 WiFi Captive Portal — Konfigurasi Tanpa Hardcode

**Version:** 1.0
**Date:** 2026-07-14
**Status:** Draft

---

## 1. Overview

### 1.1 Problem

Saat ini kredensial WiFi (`SSID`, `password`) dan konfigurasi lainnya (`API_SERVER`, `API_TOKEN`, threshold) di-hardcode di `config.h`. Setiap kali pindah jaringan atau ganti server, ESP32 harus di-reflash firmware lewat USB. Tidak praktis untuk deployment lapangan.

### 1.2 Solution

ESP32 menjalankan **WiFi AP + Captive Portal** sebagai fallback. Ketika gagal konek WiFi atau user menekan tombol fisik, ESP32 masuk mode konfigurasi: broadcast network WiFi sendiri, user connect via HP/laptop, buka halaman web untuk isi konfigurasi, simpan ke NVS/preferences, lalu ESP32 reboot dengan konfigurasi baru.

### 1.3 Goals

| Goal | Priority |
|------|----------|
| Captive portal untuk konfigurasi SSID + password WiFi | P0 |
| Konfigurasi API server URL dan JWT token via portal | P0 |
| Simpan ke NVS (non-volatile storage) — survive reboot | P0 |
| Auto-fallback: WiFi gagal → AP mode → tunggu konfigurasi | P1 |
| Tombol fisik (GPIO) untuk paksa masuk AP mode | P1 |
| Tampilkan IP AP + status di LCD | P2 |
| Web portal mobile-responsive, CSS minimal inline | P2 |

---

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│                  ESP32                       │
│                                              │
│  ┌─────────┐    ┌──────────────┐            │
│  │ WiFi STA │◄───┤ connectToWiFi│            │
│  │ (client) │    └──────┬───────┘            │
│  └─────────┘           │                     │
│                    ┌───▼────┐                │
│                    │  Mode  │                │
│                    │ Select │                │
│                    └───┬────┘                │
│         WiFi gagal?    │                     │
│         atau tombol     ▼                     │
│  ┌──────────┐   ┌────────────┐              │
│  │ WiFi AP  │   │ Web Server │              │
│  │ 192.168  │   │ Captive    │◄──HP/laptop  │
│  │  .4.1    │   │ Portal     │   connect    │
│  └──────────┘   └─────┬──────┘              │
│                       │ POST /api/config     │
│                  ┌────▼──────┐               │
│                  │  NVS Save │               │
│                  └────┬──────┘               │
│                       ▼                      │
│                    ESP.restart()             │
└─────────────────────────────────────────────┘
```

### 2.1 Flow

```
setup()
  ├─ initSensors()
  ├─ loadConfigFromNVS()
  ├─ mode = readConfigPin()
  ├─ if mode == AP atau WiFi gagal:
  │    ├─ startAP("ServerRoom-Config")
  │    ├─ startWebServer()          // serve portal at 192.168.4.1
  │    ├─ startDNSServer()          // captive portal: redirect semua domain
  │    └─ LCD: "AP Mode 192.168.4.1"
  └─ else:
       ├─ connectToWiFi()
       └─ lanjut ke loop() normal

loop()
  ├─ if AP mode:
  │    └─ dnsServer.processNextRequest()
  │         webServer.handleClient()
  └─ else:
       └─ sensorLoop() // existing
```

---

## 3. Requirements

### 3.1 Hardware

| Item | Spec |
|------|------|
| MCU | ESP32 (apa saja — original, S2, S3) |
| Tombol fisik | GPIO 0 (built-in BOOT button) atau GPIO eksternal |
| LCD | Existing I2C 16x2 untuk status |

### 3.2 Software — Library

| Library | Version | Purpose |
|---------|---------|---------|
| `WiFi.h` | built-in | WiFi AP + STA mode |
| `WebServer.h` | built-in | HTTP server untuk portal |
| `DNSServer.h` | built-in | Captive portal DNS redirect |
| `Preferences.h` | built-in | NVS storage (survive reboot) |
| `ArduinoJson` | 7.x | JSON parsing (existing) |

> **Zero dependency baru.** Semua library built-in ESP32 Arduino core.

### 3.3 NVS Keys

```cpp
// Simpan di NVS namespace "serverroom"
Key                    Type     Default
-----                  ----     -------
wifi_ssid              String   (config.h WIFI_SSID)
wifi_pass              String   (config.h WIFI_PASSWORD)
api_server             String   (config.h API_SERVER)
api_token              String   (config.h API_TOKEN)
config_set             Bool     false
```

---

## 4. Konfigurasi (`config.h`)

```cpp
// --- Portal Configuration ---
#define PORTAL_SSID        "ServerRoom-Config"
#define PORTAL_TIMEOUT     300000     // 5 menit AP mode idle → reboot
#define CONFIG_PIN         0          // GPIO 0 (BOOT btn) — tekan 5 detik untuk AP mode
#define CONFIG_HOLD_MS     5000       // 5 detik hold

// --- WiFi (fallback default) ---
const char* WIFI_SSID_DEFAULT     = "R11";
const char* WIFI_PASSWORD_DEFAULT = "Cilongok46";

// --- API (fallback default) ---
const char* API_SERVER_DEFAULT = "http://localhost:3000";
const char* API_TOKEN_DEFAULT  = "YOUR_JWT_TOKEN";
```

---

## 5. Captive Portal Web UI

### 5.1 Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Halaman konfigurasi (HTML form) |
| POST | `/api/config` | Simpan konfigurasi via JSON |
| GET | `/api/status` | Info status ESP32 (JSON) |
| GET | `*` (wildcard) | Captive portal redirect ke `/` |

### 5.2 GET `/` — HTML Form

Halaman single-page, no external CSS/JS. Mobile-first design.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Room Monitor — Setup</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0 }
    body { font-family:-apple-system,sans-serif; background:#0f172a; color:#e2e8f0; padding:20px; min-height:100vh; display:flex; align-items:center; justify-content:center }
    .card { background:#1e293b; border-radius:16px; padding:24px; width:100%; max-width:400px; border:1px solid #334155 }
    h1 { font-size:20px; margin-bottom:4px; color:#60a5fa }
    .sub { font-size:12px; color:#64748b; margin-bottom:20px }
    label { display:block; font-size:12px; color:#94a3b8; margin-bottom:4px; margin-top:12px }
    input,select { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #475569; background:#334155; color:#e2e8f0; font-size:14px }
    input:focus { border-color:#3b82f6; outline:none }
    button { width:100%; padding:12px; margin-top:20px; border:none; border-radius:8px; background:#3b82f6; color:#fff; font-size:14px; font-weight:600; cursor:pointer }
    button:disabled { opacity:0.5 }
    .toast { padding:10px; border-radius:8px; margin-top:12px; font-size:12px; display:none }
    .toast.ok { background:#166534; color:#86efac; display:block }
    .toast.err { background:#7f1d1d; color:#fca5a5; display:block }
  </style>
</head>
<body>
  <div class="card">
    <h1>Server Room Monitor</h1>
    <p class="sub">Configure WiFi & API settings</p>
    <form id="f">
      <label>WiFi SSID</label>
      <input name="ssid" required placeholder="Network name">
      <label>WiFi Password</label>
      <input name="pass" type="password" placeholder="Password" minlength="8">
      <label>API Server URL</label>
      <input name="server" required placeholder="http://192.168.1.100:3000">
      <label>API Token</label>
      <input name="token" required placeholder="JWT token">
      <button type="submit">Save &amp; Restart</button>
    </form>
    <div id="toast" class="toast"></div>
  </div>
  <script>
    f.onsubmit=async e=>{
      e.preventDefault()
      const btn=f.querySelector('button')
      btn.disabled=true;btn.textContent='Saving...'
      try{
        const r=await fetch('/api/config',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            wifi_ssid:f.ssid.value,
            wifi_pass:f.pass.value,
            api_server:f.server.value,
            api_token:f.token.value
          })
        })
        const d=await r.json()
        const t=document.getElementById('toast')
        t.className='toast '+(r.ok?'ok':'err')
        t.textContent=d.message
        if(r.ok)setTimeout(()=>location.reload(),2000)
      }catch(e){
        const t=document.getElementById('toast')
        t.className='toast err'
        t.textContent='Connection failed'
      }finally{
        btn.disabled=false;btn.textContent='Save & Restart'
      }
    }
  </script>
</body>
</html>
```

### 5.3 POST `/api/config` — Save Configuration

Request:
```json
{
  "wifi_ssid": "R11",
  "wifi_pass": "Cilongok46",
  "api_server": "http://10.72.113.51:3000",
  "api_token": "eyJhbG..."
}
```

Response (200):
```json
{
  "success": true,
  "message": "Configuration saved. ESP32 will restart in 3 seconds."
}
```

Setelah 200, ESP32:
1. Simpan semua ke NVS
2. Set `config_set = true`
3. `delay(3000)` → `ESP.restart()`

Response (400):
```json
{
  "success": false,
  "message": "All fields are required"
}
```

### 5.4 GET `/api/status` — Device Info

```json
{
  "device": "ESP32 DevKit",
  "firmware": "1.0",
  "sensors": ["DHT22","MQ2"],
  "uptime": 120,
  "free_heap": 180000,
  "config_set": false
}
```

---

## 6. Firmware Implementation

### 6.1 File Structure

```
esp32-firmware/
├── esp32-firmware.ino        # main (existing)
├── config.h                  # default config + portal settings
├── sensor_test/
│   └── sensor_test.ino       # test firmware (existing)
├── portal.ino                # captive portal module [NEW]
└── config_nvs.cpp            # NVS read/write [NEW]
```

### 6.2 `config_nvs.cpp` — NVS Helper

```cpp
#include <Preferences.h>
Preferences prefs;

void loadConfigFromNVS() {
  prefs.begin("serverroom", false);
  if (prefs.getBool("config_set", false)) {
    wifi_ssid     = prefs.getString("wifi_ssid", WIFI_SSID);
    wifi_password = prefs.getString("wifi_pass", WIFI_PASSWORD);
    api_server    = prefs.getString("api_server", API_SERVER);
    api_token     = prefs.getString("api_token", API_TOKEN);
  }
  prefs.end();
}

void saveConfigToNVS(String ssid, String pass, String server, String token) {
  prefs.begin("serverroom", false);
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", pass);
  prefs.putString("api_server", server);
  prefs.putString("api_token", token);
  prefs.putBool("config_set", true);
  prefs.end();
}

void clearConfigNVS() {
  prefs.begin("serverroom", false);
  prefs.clear();
  prefs.end();
}
```

### 6.3 `portal.ino` — Captive Portal Server

```cpp
#include <WebServer.h>
#include <DNSServer.h>

WebServer webServer(80);
DNSServer dnsServer;
bool apMode = false;
unsigned long apStartTime = 0;

void startPortal() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(PORTAL_SSID);
  apMode = true;
  apStartTime = millis();

  dnsServer.start(53, "*", WiFi.softAPIP());
  webServer.onNotFound([]() {
    webServer.send(200, "text/html", PORTAL_HTML);
  });
  webServer.on("/", []() {
    webServer.send(200, "text/html", PORTAL_HTML);
  });
  webServer.on("/api/status", []() {
    StaticJsonDocument<256> doc;
    doc["device"] = "ESP32";
    doc["firmware"] = "1.0";
    doc["uptime"] = millis() / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["config_set"] = prefs.getBool("config_set", false);
    String json;
    serializeJson(doc, json);
    webServer.send(200, "application/json", json);
  });
  webServer.on("/api/config", HTTP_POST, []() {
    if (!webServer.hasArg("plain")) {
      webServer.send(400, "application/json", "{\"success\":false,\"message\":\"Empty body\"}");
      return;
    }
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, webServer.arg("plain"));
    if (err) {
      webServer.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
      return;
    }
    const char* ssid = doc["wifi_ssid"];
    const char* pass = doc["wifi_pass"];
    const char* server = doc["api_server"];
    const char* token = doc["api_token"];
    if (!ssid || !server || !token) {
      webServer.send(400, "application/json", "{\"success\":false,\"message\":\"All fields required\"}");
      return;
    }
    saveConfigToNVS(ssid, pass, server, token);
    webServer.send(200, "application/json",
      "{\"success\":true,\"message\":\"Saved. Restarting...\"}");
    delay(3000);
    ESP.restart();
  });
  webServer.begin();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AP Mode Active");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.softAPIP().toString().c_str());
}

void portalLoop() {
  dnsServer.processNextRequest();
  webServer.handleClient();

  if (millis() - apStartTime > PORTAL_TIMEOUT && PORTAL_TIMEOUT > 0) {
    Serial.println("Portal timeout, restarting...");
    ESP.restart();
  }
}
```

### 6.4 Integrasi ke `setup()`

```cpp
void setup() {
  Serial.begin(115200);
  lcd.init(); lcd.backlight();

  dht.begin();
  calibrateMQ2();
  loadConfigFromNVS();

  pinMode(CONFIG_PIN, INPUT_PULLUP);

  // Cek tombol config ditekan 5 detik
  bool forcePortal = false;
  if (digitalRead(CONFIG_PIN) == LOW) {
    unsigned long pressStart = millis();
    while (digitalRead(CONFIG_PIN) == LOW) {
      if (millis() - pressStart > CONFIG_HOLD_MS) {
        forcePortal = true;
        break;
      }
      delay(100);
    }
  }

  if (forcePortal || !connectToWiFi()) {
    startPortal();
  } else {
    configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
    syncTime();
  }
}

void loop() {
  if (apMode) {
    portalLoop();
    return;
  }
  // ... existing sensor loop
}
```

---

## 7. LCD Display — AP Mode

| Screen | Row 0 | Row 1 |
|--------|-------|-------|
| AP Portal | `AP Mode Active` | `192.168.4.1` |
| Portal timeout | `Config Timeout` | `Restarting...` |
| Config saved | `Config Saved!` | `Restarting...` |

---

## 8. Error Handling

| Kondisi | Response |
|---------|----------|
| NVS kosong (first boot) | Pakai default dari `config.h` |
| WiFi gagal setelah config | Masuk AP mode otomatis |
| Portal idle 5 menit | Auto-restart, coba WiFi lagi |
| JSON body invalid | Return 400 + error message |
| Tombol config ditekan <5 detik | Boot normal, tidak masuk portal |
| Tombol config ditekan ≥5 detik | Reset config NVS + masuk portal |

---

## 9. User Experience Flow

### Flow 1: First Boot / Factory Reset

```
1. ESP32 dicolok power
2. LCD: "Server Room Mon" → "AP Mode Active"
3. LCD: "192.168.4.1"
4. User buka WiFi di HP, connect ke "ServerRoom-Config"
5. HP auto-buka captive portal / user buka 192.168.4.1
6. Isi form: SSID, password, API server, token
7. Submit → "Saved. Restarting..."
8. ESP32 restart → connect WiFi → masuk sensor loop
```

### Flow 2: Normal Boot

```
1. ESP32 dicolok power
2. Load NVS config → connect WiFi → berhasil
3. Masuk sensor loop normal
```

### Flow 3: Pindah Jaringan

```
1. User pindah lokasi, WiFi lama tidak tersedia
2. ESP32 gagal konek → auto masuk AP mode
3. Ulangi Flow 1
```

### Flow 4: Force Portal via Button

```
1. Tekan BOOT button 5 detik
2. ESP32 reset NVS config → masuk AP mode
3. Ulangi Flow 1
```

---

## 10. Deliverables

| # | Item | File |
|---|------|------|
| 1 | NVS config helper | `esp32-firmware/config_nvs.cpp` |
| 2 | Captive portal module | `esp32-firmware/portal.ino` |
| 3 | Portal HTML template | Inline di `portal.ino` (const string) |
| 4 | Updated config.h | Tambah `#define` portal + defaults |
| 5 | Updated main firmware | Integrasi `setup()` + `loop()` |

---

## 11. Open Questions

1. **Reset to factory?** Tombol GPIO 0 hold 10 detik → hapus NVS → factory reset. v1 cukup 5 detik masuk portal tanpa hapus NVS.
2. **Portal timeout?** Saat ini 5 menit idle. Perlu ada indikator countdown di LCD? v2.
3. **Multiple WiFi fallback?** Simpan 2-3 SSID di NVS, coba satu per satu. v2.
4. **WPA2 Enterprise?** Support untuk network kampus/kantor yang pakai username+password. v2.
5. **Secure portal?** Portal saat ini terbuka (tidak ada password). Untuk production: tambahkan PIN di halaman config.

---

## 12. Timeline Estimate

| Phase | Duration |
|-------|----------|
| NVS helper (read/write/clear) | 30 menit |
| Portal HTML template | 1 jam |
| Web server + DNS captive portal | 1 jam |
| Integrasi ke setup() + LCD | 1 jam |
| Testing (first boot, normal, force portal) | 1 jam |
| **Total** | **~4.5 jam** |
