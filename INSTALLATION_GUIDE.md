# Server Room Monitoring System - Installation Guide

**Version:** 1.0  
**Last Updated:** 2025-01-15

---

## Table of Contents
1. [Hardware Setup](#hardware-setup)
2. [Raspberry Pi 4 Configuration](#raspberry-pi-4-configuration)
3. [Database Setup](#database-setup)
4. [Backend API Setup](#backend-api-setup)
5. [ESP32 Firmware](#esp32-firmware)
6. [Frontend Dashboard](#frontend-dashboard)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)

---

## Hardware Setup

### Components Checklist
- [ ] Raspberry Pi 4 Type B (4GB RAM minimum)
- [ ] ESP32 DevKit
- [ ] DHT22 Temperature/Humidity Sensor
- [ ] MQ-9 Carbon Monoxide Sensor
- [ ] Active Buzzer (5V)
- [ ] BC547 NPN Transistor
- [ ] Resistors: 20kΩ, 10kΩ, 1kΩ
- [ ] Breadboard & Jumper Wires
- [ ] Micro USB Power (5V/2A for ESP32)
- [ ] Ethernet/WiFi for Raspberry Pi
- [ ] MicroSD Card (32GB minimum)

### ESP32 Pin Configuration

```
DHT22 Sensor:
  - VCC → ESP32 3.3V (NOT 5V!)
  - DATA → GPIO 4
  - GND → GND

MQ-9 Gas Sensor:
  - VCC → VIN (5V)
  - AOUT → GPIO 34 (via voltage divider: 20kΩ + 10kΩ)
  - DOUT → GPIO 35
  - GND → GND

Buzzer + Transistor:
  - Buzzer (+) → Transistor Collector (via 5V)
  - Buzzer (-) → GND
  - Transistor Base → GPIO 18 (via 1kΩ resistor)
  - Transistor Emitter → GND

LCD I2C (Optional):
  - VCC → 5V
  - GND → GND
  - SDA → GPIO 21
  - SCL → GPIO 22
```

---

## Raspberry Pi 4 Configuration

### Step 1: OS Installation

```bash
# Download Raspberry Pi Imager
# https://www.raspberrypi.com/software/

# 1. Insert microSD card into your computer
# 2. Open Raspberry Pi Imager
# 3. Select:
#    - Raspberry Pi OS (64-bit) - Lite
#    - microSD card
# 4. Advanced options:
#    - Enable SSH
#    - Set username/password
#    - Configure WiFi (if headless)
# 5. Write and wait for completion
```

### Step 2: Initial Setup

```bash
# SSH into Raspberry Pi
ssh pi@raspberrypi.local
# or: ssh pi@<IP_ADDRESS>

# Update system
sudo apt update
sudo apt upgrade -y

# Set timezone
sudo timedatectl set-timezone Asia/Jakarta
# Replace with your timezone: Asia/Bangkok, Europe/London, etc.

# Enable I2C and SPI (if using I2C LCD)
sudo raspi-config
# Navigate to: Interface Options > I2C > Enable
# Navigate to: Interface Options > SPI > Enable
```

### Step 3: Install Node.js

```bash
# Remove old Node.js if installed
sudo apt remove nodejs npm -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or later
```

### Step 4: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version

# Set password for postgres user
sudo -u postgres psql
# In psql prompt:
\password postgres
# Enter new password (e.g., 'SecurePassword123!')
\quit

# Create database
sudo -u postgres createdb server_monitoring
sudo -u postgres psql server_monitoring -c "CREATE USER monitoring_user WITH PASSWORD 'monitoring_password';"
sudo -u postgres psql server_monitoring -c "GRANT ALL PRIVILEGES ON DATABASE server_monitoring TO monitoring_user;"
```

### Step 5: Install Git and Clone Repository

```bash
# Install Git
sudo apt install git -y

# Create application directory
mkdir -p ~/projects
cd ~/projects

# Clone repository (or create new)
# git clone https://github.com/yourusername/server-room-monitoring.git
# cd server-room-monitoring

# If no repo yet, create local project
mkdir server-room-monitoring
cd server-room-monitoring
git init
```

---

## Database Setup

### Step 1: Load Database Schema

```bash
# Copy the DATABASE_SCHEMA.sql file to Raspberry Pi
scp DATABASE_SCHEMA.sql pi@raspberrypi.local:~/

# Connect to database and load schema
ssh pi@raspberrypi.local
psql -U monitoring_user -d server_monitoring -f ~/DATABASE_SCHEMA.sql
# When prompted, enter password: monitoring_password

# Verify tables created
psql -U monitoring_user -d server_monitoring -c "\dt"
```

### Step 2: Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf

# Find and uncomment:
# listen_addresses = 'localhost'
# Change to:
# listen_addresses = '*'

# Edit pg_hba.conf to allow local connections
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add at end:
# host    server_monitoring    monitoring_user    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Step 3: Verify Database

```bash
# Test connection
psql -U monitoring_user -d server_monitoring

# In psql:
SELECT version();
SELECT * FROM users;
\d sensor_readings
\q
```

---

## Backend API Setup

### Step 1: Create Node.js Project

```bash
cd ~/projects/server-room-monitoring

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express pg bcryptjs jsonwebtoken dotenv cors
npm install --save-dev nodemon

# Create directory structure
mkdir -p src/{routes,controllers,middleware,utils}
mkdir logs
```

### Step 2: Create Environment File

```bash
# Create .env file
cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=server_monitoring
DB_USER=monitoring_user
DB_PASSWORD=monitoring_password

# JWT Configuration
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRY=7d

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@serverroom.local

# System Configuration
TIMEZONE=Asia/Jakarta
LOG_LEVEL=info
ENABLE_BUZZER=true
EOF

# IMPORTANT: Change JWT_SECRET and database password
```

### Step 3: Create Main Server File

```bash
cat > src/server.js << 'EOF'
const express = require('express');
const pg = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Database Pool
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// API Version Info
app.get('/api/v1/info', (req, res) => {
  res.json({
    name: 'Server Room Monitoring API',
    version: '1.0.0',
    endpoints: [
      'POST /api/v1/sensor-data',
      'GET /api/v1/sensor-data/latest',
      'GET /api/v1/sensor-data/history',
      'GET /api/v1/alerts',
      'GET /api/v1/system/status'
    ]
  });
});

// Sensor Data Endpoint
app.post('/api/v1/sensor-data', async (req, res) => {
  try {
    const { temperature, humidity, co_ppm, lpg_ppm, timestamp } = req.body;
    
    // Validate input
    if (!temperature || !humidity || !co_ppm || !lpg_ppm) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Insert into database
    const query = `
      INSERT INTO sensor_readings (temperature, humidity, co_ppm, lpg_ppm, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, temperature, humidity, co_ppm, lpg_ppm, recorded_at;
    `;
    
    const result = await pool.query(query, [
      temperature, 
      humidity, 
      co_ppm, 
      lpg_ppm,
      timestamp || new Date()
    ]);

    res.status(201).json({
      success: true,
      message: 'Sensor data stored successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error inserting sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get Latest Sensor Data
app.get('/api/v1/sensor-data/latest', async (req, res) => {
  try {
    const query = `
      SELECT * FROM sensor_readings 
      ORDER BY recorded_at DESC 
      LIMIT 1;
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sensor data found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get Sensor Data History
app.get('/api/v1/sensor-data/history', async (req, res) => {
  try {
    const { start_date, end_date, limit = 100 } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date and end_date are required'
      });
    }

    const query = `
      SELECT * FROM sensor_readings 
      WHERE recorded_at BETWEEN $1 AND $2
      ORDER BY recorded_at DESC
      LIMIT $3;
    `;

    const result = await pool.query(query, [start_date, end_date, limit]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get System Status
app.get('/api/v1/system/status', async (req, res) => {
  try {
    const uptime = process.uptime();
    
    res.json({
      success: true,
      data: {
        overall_status: 'HEALTHY',
        components: {
          api_server: {
            status: 'RUNNING',
            uptime_seconds: Math.floor(uptime)
          },
          database: {
            status: 'CONNECTED'
          }
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation at http://localhost:${PORT}/api/v1/info`);
});

module.exports = app;
EOF
```

### Step 4: Add npm Scripts

```bash
# Edit package.json
cat >> package.json << 'EOF'
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
EOF

# Fix JSON formatting (remove duplicate)
npm init -y --force
```

### Step 5: Start Backend Server

```bash
# Test with npm start
npm start

# Output should show:
# ✅ Server running on http://localhost:3000
# 📚 API Documentation at http://localhost:3000/api/v1/info

# Keep running in background with PM2 (optional)
npm install -g pm2
pm2 start src/server.js --name "monitoring-api"
pm2 startup
pm2 save
```

---

## ESP32 Firmware

### Step 1: Install Arduino IDE

```bash
# Download from: https://www.arduino.cc/en/software
# Or install via package manager:
sudo apt install arduino
```

### Step 2: Add ESP32 Board

1. Open Arduino IDE
2. Go to **Preferences** (Ctrl+,)
3. In **Additional Boards Manager URLs**, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Boards Manager**
5. Search for "ESP32"
6. Install **ESP32 by Espressif Systems**

### Step 3: Install Required Libraries

In Arduino IDE, go to **Sketch → Include Library → Manage Libraries**:

- **DHT sensor library** by Adafruit
- **ArduinoJson** by Beniamin Mincu

### Step 4: Create Firmware Sketch

```cpp
// File: server_room_monitor.ino

#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API Configuration
const char* apiServer = "http://raspberrypi.local:3000/api/v1";

// Sensor Pins
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ9_AOUT 34
#define MQ9_DOUT 35
#define BUZZER_PIN 18

// DHT22 Sensor
DHT dht(DHTPIN, DHTTYPE);

// Global Variables
float temperature = 0;
float humidity = 0;
int co_ppm = 0;
int lpg_ppm = 0;
unsigned long lastSensorRead = 0;
unsigned long lastApiCall = 0;
const unsigned long SENSOR_INTERVAL = 10000;  // 10 seconds
const unsigned long API_INTERVAL = 30000;     // 30 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== Server Room Monitoring System ===");
  Serial.println("Initializing...");
  
  // Pin Setup
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Sensor Setup
  dht.begin();
  
  // WiFi Setup
  connectToWiFi();
}

void loop() {
  // Read sensors every 10 seconds
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    readSensors();
    lastSensorRead = millis();
  }
  
  // Send to API every 30 seconds
  if (millis() - lastApiCall >= API_INTERVAL) {
    sendToAPI();
    lastApiCall = millis();
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  
  delay(100);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
  }
}

void readSensors() {
  // Read DHT22
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  // Read MQ-9
  int adcValue = analogRead(MQ9_AOUT);
  co_ppm = map(adcValue, 0, 4095, 0, 1000);  // Simplified conversion
  
  int digitalValue = digitalRead(MQ9_DOUT);
  lpg_ppm = digitalValue ? 100 : 0;  // Simplified
  
  // Check for alerts
  checkAlerts();
  
  Serial.printf("Temp: %.1f°C | Humidity: %.1f%% | CO: %d ppm | LPG: %d ppm\n", 
                temperature, humidity, co_ppm, lpg_ppm);
}

void checkAlerts() {
  // Temperature Alert
  if (temperature > 35) {
    activateBuzzer(3);  // 3 beeps for critical
  } else if (temperature > 28) {
    activateBuzzer(1);  // 1 beep for warning
  }
  
  // CO Alert
  if (co_ppm > 100) {
    activateBuzzer(4);  // 4 beeps for critical CO
  }
}

void activateBuzzer(int beeps) {
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void sendToAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    return;
  }
  
  HTTPClient http;
  
  // Prepare JSON
  StaticJsonDocument<200> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["co_ppm"] = co_ppm;
  doc["lpg_ppm"] = lpg_ppm;
  doc["timestamp"] = getTimestamp();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send POST request
  String url = String(apiServer) + "/sensor-data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 201) {
    Serial.println("✅ Data sent to API successfully");
  } else {
    Serial.printf("❌ API Error: %d\n", httpCode);
  }
  
  http.end();
}

String getTimestamp() {
  // Simple timestamp - implement NTP if needed
  return "";
}
```

### Step 5: Upload Firmware

1. Select **Board**: ESP32 Dev Module
2. Select **Port**: /dev/ttyUSB0 (or your port)
3. Click **Upload**
4. Open **Serial Monitor** (Ctrl+Shift+M) at 115200 baud

---

## Frontend Dashboard

### Step 1: Create React Project

```bash
cd ~/projects
npx create-react-app server-monitoring-dashboard
cd server-monitoring-dashboard

# Install dependencies
npm install axios recharts react-router-dom
npm install --save-dev dotenv
```

### Step 2: Create .env File

```bash
cat > .env << EOF
REACT_APP_API_URL=http://raspberrypi.local:3000/api/v1
REACT_APP_WEBSOCKET_URL=ws://raspberrypi.local:3000
EOF
```

### Step 3: Create Basic Dashboard

```jsx
// File: src/App.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  const [latestData, setLatestData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestData();
    fetchHistory();
    const interval = setInterval(fetchLatestData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchLatestData = async () => {
    try {
      const response = await axios.get(`${API_URL}/sensor-data/latest`);
      setLatestData(response.data.data);
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      const response = await axios.get(`${API_URL}/sensor-data/history`, {
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          limit: 100
        }
      });
      
      setHistoryData(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching history:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="App">
      <header className="header">
        <h1>🔥 Server Room Monitoring</h1>
      </header>

      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label">Temperature</div>
          <div className="metric-value">{latestData?.temperature?.toFixed(1)}°C</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Humidity</div>
          <div className="metric-value">{latestData?.humidity?.toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">CO Level</div>
          <div className="metric-value">{latestData?.co_ppm?.toFixed(0)} ppm</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">LPG Level</div>
          <div className="metric-value">{latestData?.lpg_ppm?.toFixed(0)} ppm</div>
        </div>
      </div>

      <div className="chart-container">
        <h2>24-Hour Trend</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="recorded_at" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="temperature" stroke="#ff7300" />
            <Line type="monotone" dataKey="humidity" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
```

### Step 4: Build for Production

```bash
npm run build

# Build output in 'build/' directory
# Deploy to Raspberry Pi:
scp -r build/* pi@raspberrypi.local:/var/www/html/

# Or use nginx/Apache to serve
sudo apt install nginx
sudo cp -r build/* /var/www/html/
sudo systemctl start nginx
```

---

## Testing & Verification

### Test API Endpoints

```bash
# Get latest data
curl http://raspberrypi.local:3000/api/v1/sensor-data/latest

# Submit test data
curl -X POST http://raspberrypi.local:3000/api/v1/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 24.5,
    "humidity": 55,
    "co_ppm": 12,
    "lpg_ppm": 200
  }'

# Get system status
curl http://raspberrypi.local:3000/api/v1/system/status
```

### Test Sensors

```cpp
// In Arduino IDE, upload this test sketch:
#include "DHT.h"

#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  int co = analogRead(34);
  
  Serial.printf("Temp: %.1f°C, Humidity: %.1f%%, CO ADC: %d\n", temp, humidity, co);
  delay(2000);
}
```

---

## Troubleshooting

### Common Issues

#### WiFi Connection Issues
```bash
# Check WiFi signal
iwconfig

# Restart network
sudo systemctl restart networking

# Reset WiFi on ESP32:
// Add to Arduino code:
WiFi.disconnect(true);  // Turn off WiFi and radio
WiFi.mode(WIFI_OFF);
delay(1000);
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -U monitoring_user -d server_monitoring -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql.log
```

#### API Not Responding
```bash
# Check if Node.js process is running
pm2 list
# or
ps aux | grep node

# Check port 3000
sudo netstat -tlnp | grep 3000

# Restart API
pm2 restart monitoring-api
```

#### Sensor Reading Issues
```bash
# DHT22 Not responding:
// Add delay in setup:
delay(2000);
dht.begin();

// Verify wiring - check voltage at pin:
digitalWrite(5, HIGH);  // GPIO 5 for testing
```

---

## Performance Optimization

### Database
```sql
-- Create indexes for faster queries
CREATE INDEX idx_sensor_temp_date ON sensor_readings(recorded_at, temperature);
CREATE INDEX idx_sensor_humidity_date ON sensor_readings(recorded_at, humidity);
```

### API Caching
```bash
npm install redis
# Configure Redis caching for /latest endpoint
```

### Frontend
```bash
# Build optimized production bundle
npm run build
# Use gzip compression in nginx
```

---

## Security Checklist

- [ ] Change default admin password
- [ ] Change JWT secret in .env
- [ ] Set strong database password
- [ ] Enable HTTPS/SSL on Nginx
- [ ] Configure firewall rules
- [ ] Disable SSH password login (use keys only)
- [ ] Enable automatic updates
- [ ] Configure backup encryption
- [ ] Set up monitoring alerts
- [ ] Regular security audits

---

## Maintenance

### Daily
- Monitor system logs
- Check database size
- Verify API responsiveness

### Weekly
- Review alert logs
- Check disk space
- Backup database

### Monthly
- Update packages
- Review sensor calibration
- Test disaster recovery
- Analyze trends

---

## Support & Documentation

- API Docs: See API_DOCUMENTATION.md
- Database Schema: See DATABASE_SCHEMA.sql
- Hardware Wiring: See PRD Section 4
- Troubleshooting: See section above

---

**Last Updated:** 2025-01-15  
**Version:** 1.0.0
