const express = require('express');
const router = express.Router();
const sensor = require('../controllers/sensorController');

router.post('/', sensor.submitSensorData);
router.get('/latest', sensor.getLatest);
router.get('/history', sensor.getHistory);
router.get('/statistics', sensor.getStatistics);
router.get('/export/csv', sensor.exportCSV);
router.get('/export/json', sensor.exportJSON);

module.exports = router;
