# PRD: ESP32 USB Internet Tethering

**Version:** 1.0  
**Date:** 2026-07-02  
**Status:** Draft

---

## 1. Overview

### 1.1 Problem

ESP32 saat ini bergantung pada WiFi (`WIFI_STA`) untuk mengirim data sensor ke backend. Di lingkungan server room, WiFi sering tidak stabil, terbatas jangkauan, atau tidak tersedia sama sekali. Device lain di rack yang sama (Raspberry Pi, mini PC) sudah terhubung via kabel — ESP32 harus ikut memanfaatkan koneksi tersebut.

### 1.2 Solution

ESP32 menggunakan **USB CDC-ECM / RNDIS** (USB Ethernet) untuk terkoneksi internet melalui USB — seperti tethering HP ke laptop, tapi arahnya ESP32 ke host device. ESP32 dicolok USB ke Raspberry Pi/laptop, Pi/laptop share internet via USB, ESP32 dapat IP via DHCP, lalu kirim data sensor seperti biasa.

### 1.3 Goals

| Goal | Priority |
|------|----------|
| ESP32 dapat konek internet via USB tanpa WiFi | P0 |
| Konfigurasi fleksibel — WiFi fallback jika USB gagal | P1 |
| Tidak butuh hardware tambahan (cukup kabel USB data) | P1 |
| Zero config di sisi host (cukup enable USB tethering) | P2 |
| IP statis opsional via `config.h` | P2 |

---

## 2. Architecture

```
┌──────────┐    USB CDC-ECM     ┌──────────────┐    Ethernet/WiFi    ┌──────────┐
│  ESP32   │◄──────────────────►│ Raspberry Pi │◄──────────────────►│ Backend  │
│ (device) │   IP: 192.168.42.x │   (host)     │                    │  :3000   │
└──────────┘                    └──────────────┘                    └──────────┘
```

ESP32 berperan sebagai **USB Ethernet device** (gadget mode), host (Pi/laptop) mengenali sebagai network interface `usb0` dan memberikan IP via DHCP.

### 2.1 Protocol Stack

```
HTTP (sensor data POST)
  └─ TCP
      └─ IP (DHCP dari host)
          └─ LwIP netif (USB CDC-ECM)
              └─ TinyUSB CDC-ECM
                  └─ ESP32-S2/S3 USB OTG peripheral
```

---

## 3. Requirements

### 3.1 Hardware

| Item | Spec |
|------|------|
| MCU | ESP32-**S2** atau ESP32-**S3** (wajib — punya USB OTG native) |
| ESP32 (original) | ❌ Tidak support USB device — tetap pakai WiFi |
| Kabel | USB-C atau micro-USB **data** (bukan charge-only) |
| Host device | Raspberry Pi / laptop / HP Android (support USB tethering) |

> **⚠️ ESP32 original (ESP32-WROOM, ESP32-DevKitC) tidak bisa.** Chip CH340/CP2102-nya hanya USB-UART bridge, bukan USB OTG. Harus pakai ESP32-S2 atau ESP32-S3 yang punya D+/D- pin native.

### 3.2 Software — ESP32 Firmware

| Library | Version | Purpose |
|---------|---------|---------|
| `TinyUSB` | 2.x | USB device stack (CDC-ECM class) |
| `lwIP` | built-in | TCP/IP stack di atas USB netif |
| `ArduinoJson` | 7.x | JSON serialization (existing) |
| `DHT` | 1.x | DHT22 sensor (existing) |

**Firmware flow:**

```
setup()
  ├─ TinyUSB init (CDC-ECM device)
  ├─ DHT begin
  └─ wait for USB network ready

loop()
  ├─ USB connected?
  │   ├─ YES → use USB IP
  │   └─ NO  → fallback WiFi (connectToWiFi)
  ├─ read sensors
  └─ sendToAPI() via active interface
```

### 3.3 Software — Host Device

| Host | Config |
|------|--------|
| **Raspberry Pi** | Auto — kernel module `g_ether` / `cdc_ether` loads otomatis. Interface `usb0` muncul, `dhcpcd` / `NetworkManager` assign IP. |
| **Linux (laptop)** | Sama seperti Pi — plug & play. |
| **macOS** | System Settings > Network → USB 10/100 LAN. |
| **Windows** | Perlu driver RNDIS (biasanya auto-install). |
| **Android** | Aktifkan "USB Tethering" di settings. |

---

## 4. Configuration (`config.h`)

```cpp
// --- Connection Mode ---
#define CONNECTION_MODE  USB_FIRST  // USB_FIRST | USB_ONLY | WIFI_ONLY

// --- USB Network ---
#define USB_IP_STATIC   false       // true = static IP, false = DHCP
#define USB_STATIC_IP   "192.168.42.10"
#define USB_STATIC_GW   "192.168.42.1"
#define USB_STATIC_MASK "255.255.255.0"

// --- WiFi (fallback) ---
const char* WIFI_SSID     = "R1";
const char* WIFI_PASSWORD = "Cilongok46";

// --- API ---
const char* API_SERVER = "http://192.168.42.1:3000";
const char* API_PATH   = "/api/v1";
const char* API_TOKEN  = "YOUR_JWT_TOKEN";

// --- Sensors ---
#define DHTPIN       4
#define DHTTYPE      DHT22
#define SENSOR_READ_INTERVAL  10000
```

---

## 5. Connection Modes

### 5.1 `USB_FIRST` (default)

1. ESP32 boot → init USB CDC-ECM
2. Tunggu host recognize (maks 10 detik)
3. Dapat IP via DHCP dari host
4. **Connected** → gunakan USB
5. **Timeout / gagal** → fallback ke WiFi

### 5.2 `USB_ONLY`

1. Hanya USB, tidak ada fallback WiFi
2. Jika USB disconnect → retry loop, kirim error ke Serial
3. Cocok untuk deployment rack permanen

### 5.3 `WIFI_ONLY`

1. WiFi seperti existing firmware
2. Mode backward-compatible untuk ESP32 original

---

## 6. Host-Side Setup

### Raspberry Pi (Raspbian/Ubuntu)

Tanpa config — plug & play:

```bash
# Cek interface muncul
ip addr show usb0

# Pastikan DHCP server jalan di interface usb0
# dhcpcd atau NetworkManager auto-handle
```

Jika tidak auto, enable DHCP server untuk `usb0`:

```bash
sudo apt install dnsmasq -y
sudo tee /etc/dnsmasq.d/usb0.conf <<EOF
interface=usb0
dhcp-range=192.168.42.2,192.168.42.100,255.255.255.0,24h
EOF
sudo systemctl restart dnsmasq
```

### Mac

1. Colok ESP32 via USB
2. System Settings → Network → "USB 10/100 LAN"
3. Configure IPv4: "Using DHCP" atau manual `192.168.42.1`

---

## 7. Network Topology Options

### 7.1 ESP32 → Pi → Backend (Pi jadi router)

```
ESP32 ──USB──▶ Pi (192.168.42.1) ──Ethernet──▶ Backend
              NAT/masquerade aktif
```

Pi perlu IP forwarding + NAT:

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

ESP32 API_SERVER tetap pakai IP backend asli (misal `10.247.102.239:3000`).

### 7.2 ESP32 → Pi = Backend (all-in-one)

```
ESP32 ──USB──▶ Pi (192.168.42.1:3000)
              Backend + DB jalan di Pi
```

ESP32 API_SERVER: `http://192.168.42.1:3000`. Tanpa NAT, tanpa routing.

### 7.3 ESP32 → Laptop dev (local dev)

```
ESP32 ──USB──▶ Mac (192.168.42.x)
              Vite dev server + Backend
```

Cocok untuk development tanpa WiFi.

---

## 8. Error Handling

| Kondisi | Response |
|---------|----------|
| USB cable putus | `USB disconnected, retry...` — fallback WiFi (mode USB_FIRST) atau error (mode USB_ONLY) |
| Host tidak assign IP (10s timeout) | `USB DHCP timeout` — fallback WiFi |
| API unreachable via USB | Serial log error + retry next interval |
| USB + WiFi keduanya down | `No network available` — buffer data? (future) |

---

## 9. Deliverables

| # | Item | Format |
|---|------|--------|
| 1 | Firmware `esp32-usb.ino` | Arduino sketch |
| 2 | `config_usb.h` | Konfigurasi header |
| 3 | `usb_network.cpp/.h` | Modul USB CDC-ECM |
| 4 | Host setup guide | Bagian dari INSTALLATION_GUIDE.md |
| 5 | Wiring diagram | ASCII / PNG |

---

## 10. Open Questions

1. **ESP32-S2 vs S3?** S3 lebih mahal tapi support BLE+WiFi sebagai fallback. S2 lebih murah tapi WiFi lemah. Rekomendasi: S3.
2. **Data buffering saat offline?** Jika kedua interface down, apakah data disimpan dulu di SPIFFS/SD lalu dikirim saat reconnect? → v2.
3. **Power via USB?** ESP32-S3 bisa powered dari USB host, tidak perlu power supply terpisah. Konfirmasi arus cukup (500mA typical).
4. **Multiple ESP32 ke satu Pi?** 1 Pi bisa host >1 ESP32 via USB hub. Masing-masing dapat IP berbeda dari DHCP range.

---

## 11. Timeline Estimate

| Phase | Duration |
|-------|----------|
| TinyUSB CDC-ECM research & setup | 1 hari |
| Firmware development (USB mode + fallback) | 2 hari |
| Host setup + testing (Pi/Mac/Android) | 1 hari |
| Integration test (sensor → backend) | 1 hari |
| Documentation | 0.5 hari |
| **Total** | **~5 hari** |
