/**
 * Triage Nurse Assistant Routes
 * API endpoints for triage assessments, protocols, provider schedules, and emergency services
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== Triage Assessments ==========

// Get all triage assessments
router.get('/assessments', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, urgency_level, patient_name } = req.query;
    let query = `
      SELECT ta.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM triage_assessments ta
      LEFT JOIN conversations c ON ta.conversation_id = c.id
      LEFT JOIN ai_agents a ON c.agent_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (orgId) {
      paramCount++;
      query += ` AND (c.organization_id = $${paramCount} OR c.organization_id IS NULL)`;
      params.push(orgId);
    }

    if (status) {
      paramCount++;
      query += ` AND ta.status = $${paramCount}`;
      params.push(status);
    }

    if (urgency_level) {
      paramCount++;
      query += ` AND ta.urgency_level = $${paramCount}`;
      params.push(urgency_level);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND ta.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    query += ' ORDER BY ta.created_at DESC';

    const result = await db.query(query, params);
    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Error fetching triage assessments:', error);
    res.status(500).json({ message: 'Error fetching triage assessments', error: error.message });
  }
});

// Get triage assessment by ID
router.get('/assessments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = `
      SELECT ta.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM triage_assessments ta
      LEFT JOIN conversations c ON ta.conversation_id = c.id
      LEFT JOIN ai_agents a ON c.agent_id = a.id
      WHERE ta.id = $1
    `;
    const params = [id];

    if (orgId) {
      query += ` AND (c.organization_id = $2 OR c.organization_id IS NULL)`;
      params.push(orgId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Triage assessment not found' });
    }

    res.json({ assessment: result.rows[0] });
  } catch (error) {
    console.error('Error fetching triage assessment:', error);
    res.status(500).json({ message: 'Error fetching triage assessment', error: error.message });
  }
});

// ========== Triage Protocols ==========

// Get all triage protocols
router.get('/protocols', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM triage_protocols WHERE organization_id = $1 OR organization_id IS NULL ORDER BY protocol_name',
      [orgId]
    );

    res.json({ protocols: result.rows });
  } catch (error) {
    console.error('Error fetching triage protocols:', error);
    res.status(500).json({ message: 'Error fetching triage protocols', error: error.message });
  }
});

// Create triage protocol
router.post('/protocols', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      protocol_name,
      protocol_category,
      symptom_keywords,
      red_flags,
      escalation_action,
      severity_threshold,
      decision_tree,
      protocol_description
    } = req.body;

    if (!protocol_name || !red_flags || !escalation_action || !decision_tree) {
      return res.status(400).json({ message: 'Protocol name, red flags, escalation action, and decision tree are required' });
    }

    const result = await db.query(
      `INSERT INTO triage_protocols (
        organization_id, protocol_name, protocol_category, symptom_keywords,
        red_flags, escalation_action, severity_threshold, decision_tree, protocol_description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        orgId,
        protocol_name,
        protocol_category || null,
        symptom_keywords || [],
        JSON.stringify(red_flags),
        escalation_action,
        severity_threshold || 5,
        JSON.stringify(decision_tree),
        protocol_description || null
      ]
    );

    res.status(201).json({ protocol: result.rows[0] });
  } catch (error) {
    console.error('Error creating triage protocol:', error);
    res.status(500).json({ message: 'Error creating triage protocol', error: error.message });
  }
});

// ========== Provider Call Schedules ==========

// Get all provider schedules
router.get('/provider-schedules', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM provider_call_schedules WHERE organization_id = $1 ORDER BY provider_name',
      [orgId]
    );

    res.json({ schedules: result.rows });
  } catch (error) {
    console.error('Error fetching provider schedules:', error);
    res.status(500).json({ message: 'Error fetching provider schedules', error: error.message });
  }
});

// Create provider schedule
router.post('/provider-schedules', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      provider_name,
      provider_phone,
      provider_email,
      provider_type,
      schedule_data,
      timezone
    } = req.body;

    if (!provider_name || !schedule_data) {
      return res.status(400).json({ message: 'Provider name and schedule data are required' });
    }

    const result = await db.query(
      `INSERT INTO provider_call_schedules (
        organization_id, provider_name, provider_phone, provider_email,
        provider_type, schedule_data, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        orgId,
        provider_name,
        provider_phone || null,
        provider_email || null,
        provider_type || 'primary_care',
        JSON.stringify(schedule_data),
        timezone || 'America/New_York'
      ]
    );

    res.status(201).json({ schedule: result.rows[0] });
  } catch (error) {
    console.error('Error creating provider schedule:', error);
    res.status(500).json({ message: 'Error creating provider schedule', error: error.message });
  }
});

// ========== Emergency Service Calls ==========

// Get all emergency service calls
router.get('/emergency-calls', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, emergency_type } = req.query;
    let query = `
      SELECT esc.*, ta.protocol_pathway, ta.urgency_level
      FROM emergency_service_calls esc
      LEFT JOIN triage_assessments ta ON esc.triage_assessment_id = ta.id
      WHERE esc.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND esc.status = $${paramCount}`;
      params.push(status);
    }

    if (emergency_type) {
      paramCount++;
      query += ` AND esc.emergency_type = $${paramCount}`;
      params.push(emergency_type);
    }

    query += ' ORDER BY esc.called_at DESC';

    const result = await db.query(query, params);
    res.json({ emergency_calls: result.rows });
  } catch (error) {
    console.error('Error fetching emergency calls:', error);
    res.status(500).json({ message: 'Error fetching emergency calls', error: error.message });
  }
});

// ========== Red Flags ==========

// Get all red flags
router.get('/red-flags', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM triage_red_flags WHERE organization_id = $1 ORDER BY red_flag_name',
      [orgId]
    );

    res.json({ red_flags: result.rows });
  } catch (error) {
    console.error('Error fetching red flags:', error);
    res.status(500).json({ message: 'Error fetching red flags', error: error.message });
  }
});

// Create red flag
router.post('/red-flags', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      red_flag_name,
      red_flag_description,
      symptom_patterns,
      severity_level,
      escalation_action,
      protocol_id
    } = req.body;

    if (!red_flag_name || !symptom_patterns || !escalation_action) {
      return res.status(400).json({ message: 'Red flag name, symptom patterns, and escalation action are required' });
    }

    const result = await db.query(
      `INSERT INTO triage_red_flags (
        organization_id, red_flag_name, red_flag_description, symptom_patterns,
        severity_level, escalation_action, protocol_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        orgId,
        red_flag_name,
        red_flag_description || null,
        symptom_patterns,
        severity_level || 'emergent',
        escalation_action,
        protocol_id || null
      ]
    );

    res.status(201).json({ red_flag: result.rows[0] });
  } catch (error) {
    console.error('Error creating red flag:', error);
    res.status(500).json({ message: 'Error creating red flag', error: error.message });
  }
});

module.exports = router;

