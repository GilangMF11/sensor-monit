const pool = require('../utils/db');

exports.submitSensorData = async (req, res) => {
  try {
    const { temperature, humidity, co_ppm, lpg_ppm, timestamp } = req.body;

    if (temperature == null || humidity == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: temperature, humidity' }
      });
    }

    const co = co_ppm ?? 0;
    const lpg = lpg_ppm ?? 0;

    if (temperature < -40 || temperature > 80) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid temperature value', details: { temperature: 'Temperature must be between -40 and 80' } }
      });
    }

    const query = `
      INSERT INTO sensor_readings (temperature, humidity, co_ppm, lpg_ppm, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, temperature, humidity, co_ppm, lpg_ppm, recorded_at;
    `;
    const result = await pool.query(query, [temperature, humidity, co, lpg, timestamp || new Date()]);

    checkAlerts(temperature, humidity, co, lpg);

    res.status(201).json({
      success: true,
      message: 'Sensor data stored successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error inserting sensor data:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.getLatest = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1');

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No sensor data found' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, interval } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' }
      });
    }

    const parsedLimit = Math.min(parseInt(limit) || 100, 10000);

    if (interval && interval !== 'raw') {
      const intervalMap = {
        '1min': '1 minute',
        '5min': '5 minutes',
        '1hour': '1 hour'
      };
      const pgInterval = intervalMap[interval];
      if (!pgInterval) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid interval. Use: raw, 1min, 5min, 1hour' }
        });
      }

      const query = `
        SELECT
          date_trunc('hour', recorded_at) + 
            EXTRACT(minute FROM recorded_at)::int / $4 * $4 * interval '1 minute' AS recorded_at,
          ROUND(AVG(temperature)::numeric, 2) AS temperature,
          ROUND(AVG(humidity)::numeric, 2) AS humidity,
          ROUND(AVG(co_ppm)::numeric, 0) AS co_ppm,
          ROUND(AVG(lpg_ppm)::numeric, 0) AS lpg_ppm
        FROM sensor_readings
        WHERE recorded_at BETWEEN $1 AND $2
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT $3
      `;
      const minuteInterval = parseInt(interval.replace('min', '').replace('hour', '60'));
      const result = await pool.query(query, [start_date, end_date, parsedLimit, minuteInterval]);

      return res.json({ success: true, count: result.rows.length, data: result.rows });
    }

    const query = `
      SELECT * FROM sensor_readings
      WHERE recorded_at BETWEEN $1 AND $2
      ORDER BY recorded_at DESC
      LIMIT $3
    `;
    const result = await pool.query(query, [start_date, end_date, parsedLimit]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      pagination: { page: 1, limit: parsedLimit, total: result.rows.length }
    });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' }
      });
    }

    const query = `
      SELECT
        ROUND(MIN(temperature)::numeric, 2) AS temp_min,
        ROUND(MAX(temperature)::numeric, 2) AS temp_max,
        ROUND(AVG(temperature)::numeric, 2) AS temp_avg,
        ROUND(STDDEV(temperature)::numeric, 2) AS temp_stdev,
        ROUND(MIN(humidity)::numeric, 2) AS hum_min,
        ROUND(MAX(humidity)::numeric, 2) AS hum_max,
        ROUND(AVG(humidity)::numeric, 2) AS hum_avg,
        ROUND(STDDEV(humidity)::numeric, 2) AS hum_stdev,
        MIN(co_ppm) AS co_min,
        MAX(co_ppm) AS co_max,
        ROUND(AVG(co_ppm)::numeric, 2) AS co_avg,
        ROUND(STDDEV(co_ppm)::numeric, 2) AS co_stdev,
        MIN(lpg_ppm) AS lpg_min,
        MAX(lpg_ppm) AS lpg_max,
        ROUND(AVG(lpg_ppm)::numeric, 2) AS lpg_avg,
        ROUND(STDDEV(lpg_ppm)::numeric, 2) AS lpg_stdev,
        COUNT(*) AS total_count
      FROM sensor_readings
      WHERE recorded_at BETWEEN $1 AND $2
    `;
    const result = await pool.query(query, [start_date, end_date]);
    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        temperature: { min: parseFloat(row.temp_min), max: parseFloat(row.temp_max), avg: parseFloat(row.temp_avg), stdev: parseFloat(row.temp_stdev), count: parseInt(row.total_count) },
        humidity: { min: parseFloat(row.hum_min), max: parseFloat(row.hum_max), avg: parseFloat(row.hum_avg), stdev: parseFloat(row.hum_stdev), count: parseInt(row.total_count) },
        co_ppm: { min: row.co_min, max: row.co_max, avg: parseFloat(row.co_avg), stdev: parseFloat(row.co_stdev), count: parseInt(row.total_count) },
        lpg_ppm: { min: row.lpg_min, max: row.lpg_max, avg: parseFloat(row.lpg_avg), stdev: parseFloat(row.lpg_stdev), count: parseInt(row.total_count) }
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' }
      });
    }

    const result = await pool.query(
      'SELECT recorded_at, temperature, humidity, co_ppm, lpg_ppm FROM sensor_readings WHERE recorded_at BETWEEN $1 AND $2 ORDER BY recorded_at ASC',
      [start_date, end_date]
    );

    let csv = 'timestamp,temperature,humidity,co_ppm,lpg_ppm\n';
    for (const row of result.rows) {
      csv += `${row.recorded_at},${row.temperature},${row.humidity},${row.co_ppm},${row.lpg_ppm}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_data.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.exportJSON = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' }
      });
    }

    const result = await pool.query(
      'SELECT * FROM sensor_readings WHERE recorded_at BETWEEN $1 AND $2 ORDER BY recorded_at ASC',
      [start_date, end_date]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_data.json');
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

async function checkAlerts(temperature, humidity, co_ppm, lpg_ppm) {
  try {
    const configResult = await pool.query('SELECT sensor_type, config FROM alert_config');
    const configs = {};
    for (const row of configResult.rows) {
      configs[row.sensor_type] = row.config;
    }

    if (configs.temperature && configs.temperature.enabled) {
      if (temperature >= configs.temperature.critical_threshold) {
        await createAlert('TEMPERATURE_HIGH', 'CRITICAL', temperature, configs.temperature.critical_threshold, 'Temperature exceeded critical threshold');
      } else if (temperature >= configs.temperature.warning_threshold) {
        await createAlert('TEMPERATURE_HIGH', 'WARNING', temperature, configs.temperature.warning_threshold, 'Temperature above warning threshold');
      }
    }

    if (configs.co && configs.co.enabled) {
      if (co_ppm >= configs.co.critical_threshold) {
        await createAlert('CO_HIGH', 'CRITICAL', co_ppm, configs.co.critical_threshold, 'CO level exceeded critical threshold');
      } else if (co_ppm >= configs.co.warning_threshold) {
        await createAlert('CO_HIGH', 'WARNING', co_ppm, configs.co.warning_threshold, 'CO level above warning threshold');
      }
    }

    if (configs.lpg && configs.lpg.enabled) {
      if (lpg_ppm >= configs.lpg.critical_threshold) {
        await createAlert('LPG_HIGH', 'CRITICAL', lpg_ppm, configs.lpg.critical_threshold, 'LPG level exceeded critical threshold');
      } else if (lpg_ppm >= configs.lpg.warning_threshold) {
        await createAlert('LPG_HIGH', 'WARNING', lpg_ppm, configs.lpg.warning_threshold, 'LPG level above warning threshold');
      }
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
}

async function createAlert(type, severity, value, threshold, message) {
  try {
    const recent = await pool.query(
      'SELECT id FROM alerts WHERE type = $1 AND resolved = false AND created_at > NOW() - INTERVAL \'5 minutes\' LIMIT 1',
      [type]
    );
    if (recent.rows.length > 0) return;

    await pool.query(
      'INSERT INTO alerts (type, severity, value, threshold, message) VALUES ($1, $2, $3, $4, $5)',
      [type, severity, value, threshold, message]
    );
    console.log(`Alert created: ${severity} - ${type}: ${message}`);
  } catch (error) {
    console.error('Error creating alert:', error);
  }
}
