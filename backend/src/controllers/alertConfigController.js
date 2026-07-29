const pool = require('../utils/db');

exports.getConfig = async (req, res) => {
  try {
    const result = await pool.query('SELECT sensor_type, config FROM alert_config ORDER BY sensor_type');
    const config = {};
    for (const row of result.rows) {
      config[row.sensor_type] = row.config;
    }

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching alert config:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const updates = req.body;

    for (const [sensorType, newConfig] of Object.entries(updates)) {
      const existing = await pool.query('SELECT config FROM alert_config WHERE sensor_type = $1', [sensorType]);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Unknown sensor type: ${sensorType}` }
        });
      }

      const merged = { ...existing.rows[0].config, ...newConfig };
      await pool.query(
        'UPDATE alert_config SET config = $1, updated_at = NOW() WHERE sensor_type = $2',
        [JSON.stringify(merged), sensorType]
      );
    }

    const result = await pool.query('SELECT sensor_type, config FROM alert_config ORDER BY sensor_type');
    const config = {};
    for (const row of result.rows) {
      config[row.sensor_type] = row.config;
    }

    res.json({ success: true, message: 'Alert configuration updated', data: config });
  } catch (error) {
    console.error('Error updating alert config:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};
