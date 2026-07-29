-- Server Room Monitoring System - Database Schema
-- PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    temperature NUMERIC(5,2),
    humidity NUMERIC(5,2),
    co_ppm INTEGER,
    lpg_ppm INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    value NUMERIC(10,2),
    threshold NUMERIC(10,2),
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolve_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_config (
    id SERIAL PRIMARY KEY,
    sensor_type VARCHAR(50) UNIQUE NOT NULL,
    config JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO alert_config (sensor_type, config) VALUES
('temperature', '{"warning_threshold": 28, "critical_threshold": 35, "enabled": true}'),
('humidity', '{"warning_low": 30, "warning_high": 80, "critical_low": 20, "critical_high": 90, "enabled": true}'),
('co', '{"warning_threshold": 35, "critical_threshold": 100, "enabled": true}'),
('lpg', '{"warning_threshold": 1000, "critical_threshold": 5000, "enabled": true}')
ON CONFLICT (sensor_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
