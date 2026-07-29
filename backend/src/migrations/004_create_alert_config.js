module.exports = {
  name: '004_create_alert_config',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_config (
        id SERIAL PRIMARY KEY,
        sensor_type VARCHAR(50) UNIQUE NOT NULL,
        config JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }
};
