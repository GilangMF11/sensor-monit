# Server Room Monitoring System - API Documentation

**Base URL:** `http://raspberrypi.local:3000/api/v1`  
**Content-Type:** `application/json`

---

## Authentication

All endpoints (except `/health`) require JWT token in header:

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Get Token

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

---

## Sensor Data Endpoints

### 1. Submit Sensor Data (ESP32 → Backend)

**Endpoint:** `POST /sensor-data`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <TOKEN>
```

**Request Body:**
```json
{
  "temperature": 24.5,
  "humidity": 55,
  "co_ppm": 12,
  "lpg_ppm": 200,
  "timestamp": "2025-01-15T10:30:45Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Sensor data stored successfully",
  "data": {
    "id": 1234,
    "temperature": 24.5,
    "humidity": 55,
    "co_ppm": 12,
    "lpg_ppm": 200,
    "recorded_at": "2025-01-15T10:30:45Z"
  }
}
```

**Error (400 Bad Request):**
```json
{
  "success": false,
  "message": "Invalid temperature value",
  "errors": {
    "temperature": "Temperature must be between -40 and 80"
  }
}
```

---

### 2. Get Latest Sensor Data

**Endpoint:** `GET /sensor-data/latest`

**Headers:**
```
Authorization: Bearer <TOKEN>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1234,
    "temperature": 24.5,
    "humidity": 55,
    "co_ppm": 12,
    "lpg_ppm": 200,
    "recorded_at": "2025-01-15T10:30:45Z"
  }
}
```

---

### 3. Get Sensor Data History

**Endpoint:** `GET /sensor-data/history`

**Query Parameters:**
- `start_date` (required): ISO 8601 format (e.g., 2025-01-01T00:00:00Z)
- `end_date` (required): ISO 8601 format
- `limit` (optional): Max records to return (default: 100, max: 10000)
- `interval` (optional): Data aggregation interval - raw, 1min, 5min, 1hour (default: raw)

**Example Request:**
```bash
GET /sensor-data/history?start_date=2025-01-14T00:00:00Z&end_date=2025-01-15T23:59:59Z&limit=100&interval=1min
Authorization: Bearer <TOKEN>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "id": 1234,
      "temperature": 24.5,
      "humidity": 55,
      "co_ppm": 12,
      "lpg_ppm": 200,
      "recorded_at": "2025-01-15T10:30:45Z"
    },
    {
      "id": 1235,
      "temperature": 24.6,
      "humidity": 55.2,
      "co_ppm": 13,
      "lpg_ppm": 205,
      "recorded_at": "2025-01-15T10:31:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 50
  }
}
```

---

### 4. Get Statistics

**Endpoint:** `GET /sensor-data/statistics`

**Query Parameters:**
- `start_date` (required): ISO 8601 format
- `end_date` (required): ISO 8601 format

**Example Request:**
```bash
GET /sensor-data/statistics?start_date=2025-01-01T00:00:00Z&end_date=2025-01-15T23:59:59Z
Authorization: Bearer <TOKEN>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "temperature": {
      "min": 20.1,
      "max": 28.5,
      "avg": 24.3,
      "stdev": 1.2,
      "count": 1440
    },
    "humidity": {
      "min": 45,
      "max": 70,
      "avg": 55,
      "stdev": 5.2,
      "count": 1440
    },
    "co_ppm": {
      "min": 5,
      "max": 45,
      "avg": 12,
      "stdev": 3.1,
      "count": 1440
    },
    "lpg_ppm": {
      "min": 100,
      "max": 500,
      "avg": 200,
      "stdev": 50,
      "count": 1440
    }
  }
}
```

---

## Alert Endpoints

### 1. Get All Alerts

**Endpoint:** `GET /alerts`

**Query Parameters:**
- `limit` (optional): Max records (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `severity` (optional): Filter by CRITICAL, WARNING, INFO
- `resolved` (optional): true/false

**Example Request:**
```bash
GET /alerts?limit=20&severity=CRITICAL&resolved=false
Authorization: Bearer <TOKEN>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "type": "TEMPERATURE_HIGH",
      "severity": "CRITICAL",
      "value": 35.2,
      "threshold": 35,
      "message": "Temperature exceeded critical threshold",
      "created_at": "2025-01-15T14:22:30Z",
      "resolved": false,
      "resolved_at": null
    },
    {
      "id": 2,
      "type": "CO_HIGH",
      "severity": "WARNING",
      "value": 45,
      "threshold": 35,
      "message": "CO level above warning threshold",
      "created_at": "2025-01-15T13:15:22Z",
      "resolved": true,
      "resolved_at": "2025-01-15T13:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

### 2. Mark Alert as Resolved

**Endpoint:** `PUT /alerts/{id}/resolve`

**Request:**
```json
{
  "note": "Issue investigated and resolved"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alert marked as resolved",
  "data": {
    "id": 1,
    "type": "TEMPERATURE_HIGH",
    "resolved": true,
    "resolved_at": "2025-01-15T15:00:00Z"
  }
}
```

---

## Alert Configuration Endpoints

### 1. Get Alert Configuration

**Endpoint:** `GET /alert-config`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "temperature": {
      "warning_threshold": 28,
      "critical_threshold": 35,
      "enabled": true
    },
    "humidity": {
      "warning_low": 30,
      "warning_high": 80,
      "critical_low": 20,
      "critical_high": 90,
      "enabled": true
    },
    "co": {
      "warning_threshold": 35,
      "critical_threshold": 100,
      "enabled": true
    },
    "lpg": {
      "warning_threshold": 1000,
      "critical_threshold": 5000,
      "enabled": true
    }
  }
}
```

---

### 2. Update Alert Configuration

**Endpoint:** `PUT /alert-config`

**Request:**
```json
{
  "temperature": {
    "warning_threshold": 30,
    "critical_threshold": 38
  },
  "humidity": {
    "warning_low": 35,
    "warning_high": 75
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alert configuration updated",
  "data": { /* updated config */ }
}
```

---

## System Status Endpoints

### 1. Get System Health

**Endpoint:** `GET /system/status`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "overall_status": "HEALTHY",
    "components": {
      "api_server": {
        "status": "RUNNING",
        "uptime_seconds": 86400,
        "response_time_ms": 45
      },
      "database": {
        "status": "RUNNING",
        "connection_pool": "10/20",
        "last_backup": "2025-01-15T00:00:00Z"
      },
      "esp32_device": {
        "status": "CONNECTED",
        "last_data_received": "2025-01-15T15:45:22Z",
        "signal_strength": -65,
        "uptime_seconds": 172800
      },
      "disk_space": {
        "status": "HEALTHY",
        "used_percent": 35,
        "available_gb": 20.5
      }
    }
  }
}
```

---

### 2. Health Check (No Auth Required)

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T15:45:30Z",
  "version": "1.0.0"
}
```

---

## Data Export Endpoints

### 1. Export as CSV

**Endpoint:** `GET /sensor-data/export/csv`

**Query Parameters:**
- `start_date` (required)
- `end_date` (required)

**Response:** CSV file download

```csv
timestamp,temperature,humidity,co_ppm,lpg_ppm
2025-01-15T10:00:00Z,24.5,55,12,200
2025-01-15T10:01:00Z,24.6,55.2,13,205
```

---

### 2. Export as JSON

**Endpoint:** `GET /sensor-data/export/json`

**Query Parameters:**
- `start_date` (required)
- `end_date` (required)

**Response:** JSON file download with same structure as history endpoint

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "temperature",
        "message": "Temperature must be a number"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid/expired JWT token |
| FORBIDDEN | 403 | User doesn't have permission |
| VALIDATION_ERROR | 400 | Invalid input parameters |
| NOT_FOUND | 404 | Resource not found |
| DUPLICATE_ERROR | 409 | Resource already exists |
| DATABASE_ERROR | 500 | Database operation failed |
| SERVER_ERROR | 500 | Internal server error |

---

## Rate Limiting

- **Default limit:** 100 requests per minute per IP
- **Headers returned:**
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 95
  - `X-RateLimit-Reset`: 1642256400

---

## Webhook Notifications (Optional)

ESP32 can receive webhook callbacks for alerts:

**Endpoint:** `POST /webhooks/alert`

**Request to ESP32:**
```json
{
  "event": "ALERT_TRIGGERED",
  "alert": {
    "id": 1,
    "type": "TEMPERATURE_HIGH",
    "severity": "CRITICAL",
    "value": 35.2
  }
}
```

**Expected ESP32 Response (200 OK):**
```json
{
  "success": true,
  "action": "BUZZER_ACTIVATED"
}
```

---

## Sample cURL Requests

### Submit Sensor Data
```bash
curl -X POST http://raspberrypi.local:3000/api/v1/sensor-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "temperature": 24.5,
    "humidity": 55,
    "co_ppm": 12,
    "lpg_ppm": 200,
    "timestamp": "2025-01-15T10:30:45Z"
  }'
```

### Get Latest Data
```bash
curl -X GET http://raspberrypi.local:3000/api/v1/sensor-data/latest \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get History (Last 7 Days)
```bash
curl -X GET "http://raspberrypi.local:3000/api/v1/sensor-data/history?start_date=2025-01-08T00:00:00Z&end_date=2025-01-15T23:59:59Z&limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Versioning

- Current API version: **v1**
- All endpoints start with `/api/v1/`
- Future updates will maintain backward compatibility or create new `/api/v2/` endpoints
