const express = require('express');
const router = express.Router();
const alerts = require('../controllers/alertController');

router.get('/', alerts.getAll);
router.put('/:id/resolve', alerts.resolve);

module.exports = router;
