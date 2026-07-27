# PRD: Telegram Push Notification untuk Alert Threshold

**Version:** 1.0  
**Date:** 2026-07-14  
**Status:** Draft

---

## 1. Overview

### 1.1 Problem

Saat sensor melampaui threshold (suhu >35°C, CO >100ppm, dsb), sistem hanya mencatat alert ke database. Operator tidak mendapat notifikasi real-time — harus refresh dashboard manual. Jika operator tidak di depan dashboard, alert terlewat.

### 1.2 Solution

Backend mengirim push notification via **Telegram Bot API** setiap kali alert dibuat, langsung ke chat/group operator. Telegram dipilih karena:
- Gratis, tanpa batas push
- Bot setup 2 menit via `@BotFather`
- API sederhana: satu HTTP POST
- Sudah digunakan luas di monitoring/IoT
- Tidak perlu FCM/APNs yang ribet

### 1.3 Goals

| Goal | Priority |
|------|----------|
| Kirim notif Telegram saat threshold breached (WARNING + CRITICAL) | P0 |
| Format pesan informatif: sensor, severity, nilai vs threshold, timestamp | P0 |
| Dedup: tidak spam notif untuk alert yang sama dalam 5 menit | P1 |
| Konfigurasi bot token & chat ID via `.env` | P1 |
| Opsi kirim hanya CRITICAL atau WARNING juga | P2 |
| Kirim notif saat alert di-resolve (optional) | P3 |

---

## 2. Architecture

```
ESP32 ──POST──▶ Backend ──checkAlerts()──▶ DB (alerts)
                         │
                         └── notifyTelegram() ──POST──▶ api.telegram.org/bot<token>/sendMessage
                                                                       │
                                                                       ▼
                                                              Telegram App (operator)
```

### 2.1 Flow

```
1. ESP32 POST /api/v1/sensor-data
2. sensorController.submitSensorData() → checkAlerts(t, h, co, lpg)
3. checkAlerts() deteksi temperature >= critical_threshold
4. createAlert() → INSERT ke DB alerts
5. [NEW] → notifyTelegram(alert) → POST ke Telegram Bot API
6. Operator terima pesan di HP/Desktop Telegram
```

---

## 3. Requirements

### 3.1 Telegram Bot Setup (One-time)

1. Buka Telegram, chat ke `@BotFather`
2. Kirim `/newbot`, ikuti instruksi, dapat **bot token** (contoh: `123456:ABC-DEF1234gh...`)
3. Buka bot yang sudah dibuat, kirim `/start`
4. Dapatkan **chat ID**:
   - Kirim pesan apapun ke bot
   - Buka `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Copy `result[0].message.chat.id`
5. Untuk group: tambahkan bot ke group, kirim pesan di group, cek `getUpdates`

### 3.2 Backend — Environment Variables

Tambah ke `backend/.env`:

```env
# Telegram Notification
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghiklmnopqrstuvwxyz
TELEGRAM_CHAT_IDS=-123456789,987654321
TELEGRAM_NOTIFY_SEVERITY=ALL          # ALL | CRITICAL | WARNING
TELEGRAM_RETRY_COUNT=3
TELEGRAM_RETRY_DELAY_MS=2000
```

### 3.3 Backend — Module Baru

**`backend/src/utils/telegram.js`**

```js
const TELEGRAM_API = 'https://api.telegram.org'

async function sendAlert(alert) {
  if (process.env.TELEGRAM_ENABLED !== 'true') return

  const severity = { CRITICAL: '🔴', WARNING: '🟡', INFO: '🔵' }
  const msg = [
    `${severity[alert.severity] || '⚪'} *${alert.type}* — ${alert.severity}`,
    `📊 Value: \`${alert.value}\` / Threshold: \`${alert.threshold}\``,
    `📝 ${alert.message}`,
    `🕐 ${new Date(alert.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
  ].join('\n')

  const chatIds = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token || chatIds.length === 0) {
    console.warn('[Telegram] Not configured, skipping notification')
    return
  }

  const severityFilter = process.env.TELEGRAM_NOTIFY_SEVERITY || 'ALL'
  if (severityFilter !== 'ALL' && severityFilter !== alert.severity) return

  for (const chatId of chatIds) {
    await _sendWithRetry(token, chatId, msg)
  }
}

async function _sendWithRetry(token, chatId, text, retries = 3) {
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`
  const delay = parseInt(process.env.TELEGRAM_RETRY_DELAY_MS) || 2000

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      })
      if (res.ok) return
      const err = await res.json()
      console.error(`[Telegram] send failed (${i + 1}/${retries}):`, err.description)
    } catch (e) {
      console.error(`[Telegram] network error (${i + 1}/${retries}):`, e.message)
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delay))
  }
}

module.exports = { sendAlert }
```

### 3.4 Backend — Integrasi ke Alert System

**`backend/src/controllers/sensorController.js`** — modifikasi `createAlert()`:

```js
const { sendAlert } = require('../utils/telegram')

async function createAlert(type, severity, value, threshold, message) {
  try {
    const recent = await pool.query(
      'SELECT id FROM alerts WHERE type = $1 AND resolved = false AND created_at > NOW() - INTERVAL \'5 minutes\' LIMIT 1',
      [type]
    )
    if (recent.rows.length > 0) return

    const result = await pool.query(
      'INSERT INTO alerts (type, severity, value, threshold, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [type, severity, value, threshold, message]
    )

    const alert = result.rows[0]
    console.log(`Alert created: ${severity} - ${type}: ${message}`)

    // [NEW] Push to Telegram
    sendAlert(alert).catch(e => console.error('[Telegram] sendAlert error:', e))

  } catch (error) {
    console.error('Error creating alert:', error);
  }
}
```

> `sendAlert()` dipanggil **after insert**, non-blocking (`.catch()` terpisah). Jika Telegram gagal, alert tetap tersimpan di DB.

### 3.5 Frontend — Alert Config Page (Opsional P2)

Tambahkan field di `alert_config` JSONB per sensor untuk mengaktifkan/menonaktifkan notifikasi per tipe sensor:

```json
{
  "warning_threshold": 28,
  "critical_threshold": 35,
  "enabled": true,
  "notify_telegram": true
}
```

Ini opsional — versi awal cukup via `.env`.

---

## 4. Message Format

### 4.1 Critical Alert

```
🔴 TEMPERATURE_HIGH — CRITICAL
📊 Value: 37.5 / Threshold: 35
📝 Temperature exceeded critical threshold
🕐 14/07/2026, 15:30:42
```

### 4.2 Warning Alert

```
🟡 CO_HIGH — WARNING
📊 Value: 55 / Threshold: 35
📝 CO level above warning threshold
🕐 14/07/2026, 15:31:00
```

### 4.3 Resolved Alert (P3 — future)

```
✅ TEMPERATURE_HIGH resolved
📝 AC unit restarted, temperature normal
🕐 14/07/2026, 15:45:10
```

---

## 5. Error Handling

| Kondisi | Response |
|---------|----------|
| Bot token invalid | Log warning, alert tetap ke DB |
| Chat ID not found | Log error, skip chat ID itu |
| Telegram API down | Retry 3x dengan delay 2s, lalu skip |
| `TELEGRAM_ENABLED=false` | Skip seluruh notifikasi |
| Network unreachable | Retry, log error, tidak block main flow |

---

## 6. Dedup & Rate Limiting

- Alert dedup existing: 5 menit window per `type` (sudah ada di `createAlert`)
- Telegram sendiri punya rate limit: ~30 msg/detik per chat — tidak relevan untuk skala ini
- Tidak perlu rate limit tambahan. Satu bot, satu chat, max beberapa msg/menit

---

## 7. Security Notes

- Bot token JANGAN commit ke repo. Simpan di `.env` (sudah di `.gitignore`)
- Chat ID juga di `.env`. Untuk multi-user: pisahkan dengan koma
- Bot hanya bisa kirim pesan — tidak bisa baca pesan user/grup lain (Telegram Bot API security model)

---

## 8. Testing

### 8.1 Unit — `telegram.js`

```bash
# Set env sementara
export TELEGRAM_ENABLED=true
export TELEGRAM_BOT_TOKEN="123:abc"
export TELEGRAM_CHAT_IDS="123456"
export TELEGRAM_NOTIFY_SEVERITY="ALL"

# Run test script
node -e "
const { sendAlert } = require('./src/utils/telegram');
sendAlert({ type:'TEST', severity:'WARNING', value:50, threshold:35, message:'Test alert', created_at: new Date().toISOString() });
"
```

### 8.2 Integration — Trigger via API

```bash
# POST sensor data yang melampaui threshold
curl -X POST http://localhost:3000/api/v1/sensor-data \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"temperature":38,"humidity":45,"co_ppm":0,"lpg_ppm":0}'
```

Harus muncul alert di DB **dan** notif Telegram.

### 8.3 Edge Cases

| Case | Expected |
|------|----------|
| `TELEGRAM_ENABLED=false` | Tidak kirim notif |
| Bot token kosong | Log warning, tidak crash |
| Chat IDs kosong | Log warning, tidak crash |
| Alert ter-dedup (5 min) | Tidak kirim notif (alert tidak dibuat) |
| Alert CRITICAL tapi filter WARNING only | Tidak kirim |
| Dua alert simultaneous | Keduanya terkirim |

---

## 9. Deliverables

| # | Item | File |
|---|------|------|
| 1 | Telegram notification module | `backend/src/utils/telegram.js` |
| 2 | Integrasi ke alert system | Modifikasi `backend/src/controllers/sensorController.js` |
| 3 | Environment config | Tambah ke `backend/.env` |
| 4 | `.env.example` update | Tambah key Telegram dengan placeholder |
| 5 | Test script | `backend/test_telegram.sh` |

---

## 10. Open Questions

1. **Multiple chat IDs vs single group?** Lebih baik satu group Telegram untuk semua operator — satu chat ID, semua operator lihat. Alternatif: multiple chat ID pribadi (pisah koma).
2. **Notifikasi resolve?** Apakah perlu notif saat alert di-resolve? v2.
3. **Per-sensor notification toggle?** v2 — simpan di `alert_config` JSONB.
4. **Gambar/chart di notifikasi?** Telegram support image via `sendPhoto`. Bisa kirim screenshot chart. v3.
5. **Inline button (acknowledge)?** Telegram inline keyboard untuk "Acknowledge" / "Resolve" langsung dari notif. v3.

---

## 11. Timeline Estimate

| Phase | Duration |
|-------|----------|
| Buat Telegram Bot & dapatkan token/chat ID | 10 menit |
| Implementasi `telegram.js` | 1 jam |
| Integrasi ke `sensorController.js` | 30 menit |
| Testing (unit + integration) | 30 menit |
| Dokumentasi | 15 menit |
| **Total** | **~2.5 jam** |
