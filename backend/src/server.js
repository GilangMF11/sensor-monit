const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sensorDataRoutes = require('./routes/sensorData');
const alertRoutes = require('./routes/alerts');
const alertConfigRoutes = require('./routes/alertConfig');
const systemRoutes = require('./routes/system');
const authMiddleware = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }
});
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.get('/api/v1/info', (req, res) => {
  res.json({
    name: 'Server Room Monitoring API',
    version: '1.0.0',
    endpoints: [
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/login',
      'POST /api/v1/sensor-data',
      'GET  /api/v1/sensor-data/latest',
      'GET  /api/v1/sensor-data/history',
      'GET  /api/v1/sensor-data/statistics',
      'GET  /api/v1/sensor-data/export/csv',
      'GET  /api/v1/sensor-data/export/json',
      'GET  /api/v1/alerts',
      'PUT  /api/v1/alerts/:id/resolve',
      'GET  /api/v1/alert-config',
      'PUT  /api/v1/alert-config',
      'GET  /api/v1/system/status'
    ]
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sensor-data', authMiddleware, sensorDataRoutes);
app.use('/api/v1/alerts', authMiddleware, alertRoutes);
app.use('/api/v1/alert-config', authMiddleware, alertConfigRoutes);
app.use('/api/v1/system', authMiddleware, systemRoutes);

app.use((req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Documentation at http://localhost:${PORT}/api/v1/info`);
});

module.exports = app;
