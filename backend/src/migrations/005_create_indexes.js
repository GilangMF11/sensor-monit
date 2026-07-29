module.exports = {
  name: '005_create_indexes',
  async up(client) {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);`);
  }
};
