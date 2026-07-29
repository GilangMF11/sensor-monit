const pool = require('../utils/db');

exports.getAll = async (req, res) => {
  try {
    const { limit = 50, offset = 0, severity, resolved } = req.query;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (resolved !== undefined) {
      query += ` AND resolved = $${paramIndex++}`;
      params.push(resolved === 'true');
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      pagination: { page: Math.floor(offset / limit) + 1, limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};

exports.resolve = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      'UPDATE alerts SET resolved = true, resolved_at = NOW(), resolve_note = $1 WHERE id = $2 RETURNING *',
      [note || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }

    res.json({ success: true, message: 'Alert marked as resolved', data: result.rows[0] });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Internal server error' } });
  }
};
