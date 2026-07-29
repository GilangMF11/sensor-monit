const express = require('express');
const router = express.Router();
const alertConfig = require('../controllers/alertConfigController');

router.get('/', alertConfig.getConfig);
router.put('/', alertConfig.updateConfig);

module.exports = router;
