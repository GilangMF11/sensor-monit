const express = require('express');
const router = express.Router();
const system = require('../controllers/systemController');

router.get('/status', system.getStatus);

module.exports = router;
