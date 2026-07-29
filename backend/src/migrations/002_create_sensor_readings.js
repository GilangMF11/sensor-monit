module.exports = {
  name: '002_create_sensor_readings',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id SERIAL PRIMARY KEY,
        temperature NUMERIC(5,2),
        humidity NUMERIC(5,2),
        co_ppm INTEGER,
        lpg_ppm INTEGER,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }
};
