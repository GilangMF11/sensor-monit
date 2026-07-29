module.exports = {
  name: '006_seed_default_alert_config',
  async up(client) {
    await client.query(`
      INSERT INTO alert_config (sensor_type, config) VALUES
        ('temperature', '{"warning_threshold": 28, "critical_threshold": 35, "enabled": true}'),
        ('humidity', '{"warning_low": 30, "warning_high": 80, "critical_low": 20, "critical_high": 90, "enabled": true}'),
        ('co', '{"warning_threshold": 35, "critical_threshold": 100, "enabled": true}'),
        ('lpg', '{"warning_threshold": 1000, "critical_threshold": 5000, "enabled": true}')
      ON CONFLICT (sensor_type) DO NOTHING;
    `);
  }
};
