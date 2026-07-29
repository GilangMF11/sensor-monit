const pool = require('../utils/db');

exports.getStatus = async (req, res) => {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    let dbStatus = 'DISCONNECTED';
    let poolInfo = 'N/A';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'RUNNING';
      poolInfo = `${pool.idleCount}/${pool.totalCount || pool.options.max || 10}`;
    } catch (e) {
      dbStatus = 'ERROR';
    }

    let lastData = null;
    try {
      const result = await pool.query('SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1');
      if (result.rows.length > 0) {
        lastData = result.rows[0].recorded_at;
      }
    } catch (e) {}

    res.json({
      success: true,
      data: {
        overall_status: dbStatus === 'RUNNING' ? 'HEALTHY' : 'DEGRADED',
        components: {
          api_server: {
            status: 'RUNNING',
            uptime_seconds: Math.floor(uptime),
            memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024)
          },
          database: {
            status: dbStatus,
            connection_pool: poolInfo
          },
          esp32_device: {
            status: lastData ? 'CONNECTED' : 'UNKNOWN',
            last_data_received: lastData
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
};
