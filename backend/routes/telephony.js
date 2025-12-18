const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all phone numbers for organization
router.get('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ phone_numbers: result.rows });
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({ message: 'Error fetching phone numbers' });
  }
});

// Add phone number
router.post('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { phone_number, provider, provider_sid, capabilities, monthly_cost } = req.body;

    const result = await db.query(
      `INSERT INTO phone_numbers (organization_id, phone_number, provider, provider_sid, capabilities, monthly_cost)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, phone_number, provider, provider_sid, JSON.stringify(capabilities || {}), monthly_cost]
    );

    res.status(201).json({ phone_number: result.rows[0] });
  } catch (error) {
    console.error('Error creating phone number:', error);
    res.status(500).json({ message: 'Error creating phone number' });
  }
});

// Get call logs
router.get('/calls', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, agent_id, status, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    let query = `
      SELECT cl.*, aa.name as agent_name, aa.type as agent_type, pn.phone_number
      FROM call_logs cl
      LEFT JOIN ai_agents aa ON cl.agent_id = aa.id
      LEFT JOIN phone_numbers pn ON cl.phone_number_id = pn.id
      WHERE cl.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (agent_id) {
      paramCount++;
      query += ` AND cl.agent_id = $${paramCount}`;
      params.push(agent_id);
    }

    if (status) {
      paramCount++;
      query += ` AND cl.status = $${paramCount}`;
      params.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND cl.started_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND cl.started_at <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY cl.started_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM call_logs WHERE organization_id = $1',
      [orgId]
    );

    res.json({
      calls: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ message: 'Error fetching call logs' });
  }
});

// Create call log entry
router.post('/calls', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const {
      phone_number_id,
      agent_id,
      conversation_id,
      caller_phone,
      caller_name,
      direction,
      status,
      duration_seconds,
      recording_url,
      transcription_text,
      cost,
      provider_call_id,
      started_at,
      ended_at
    } = req.body;

    const result = await db.query(
      `INSERT INTO call_logs (
        organization_id, phone_number_id, agent_id, conversation_id,
        caller_phone, caller_name, direction, status, duration_seconds,
        recording_url, transcription_text, cost, provider_call_id,
        started_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        orgId, phone_number_id, agent_id, conversation_id,
        caller_phone, caller_name, direction, status, duration_seconds,
        recording_url, transcription_text, cost, provider_call_id,
        started_at, ended_at
      ]
    );

    res.status(201).json({ call: result.rows[0] });
  } catch (error) {
    console.error('Error creating call log:', error);
    res.status(500).json({ message: 'Error creating call log' });
  }
});

module.exports = router;

