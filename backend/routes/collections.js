/**
 * Collections Specialist Routes
 * API endpoints for payment plans, reminders, TCPA compliance, and collections cases
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== Payment Plans ==========

// Get all payment plans
router.get('/payment-plans', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, patient_name } = req.query;
    let query = `
      SELECT pp.*, ps.statement_number, ps.balance_due as original_balance
      FROM payment_plans pp
      LEFT JOIN patient_statements ps ON pp.statement_id = ps.id
      LEFT JOIN conversations c ON pp.conversation_id = c.id
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
      query += ` AND pp.status = $${paramCount}`;
      params.push(status);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND pp.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    query += ' ORDER BY pp.created_at DESC';

    const result = await db.query(query, params);
    res.json({ payment_plans: result.rows });
  } catch (error) {
    console.error('Error fetching payment plans:', error);
    res.status(500).json({ message: 'Error fetching payment plans', error: error.message });
  }
});

// Get payment plan by ID
router.get('/payment-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const planResult = await db.query(
      `SELECT pp.*, 
              (SELECT json_agg(json_build_object(
                'id', ppp.id,
                'scheduled_payment_date', ppp.scheduled_payment_date,
                'payment_amount', ppp.payment_amount,
                'payment_status', ppp.payment_status,
                'paid_at', ppp.paid_at
              )) FROM payment_plan_payments ppp WHERE ppp.payment_plan_id = pp.id) as scheduled_payments
       FROM payment_plans pp
       LEFT JOIN conversations c ON pp.conversation_id = c.id
       WHERE pp.id = $1 AND (c.organization_id = $2 OR c.organization_id IS NULL)`,
      [id, orgId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ message: 'Payment plan not found' });
    }

    res.json({ payment_plan: planResult.rows[0] });
  } catch (error) {
    console.error('Error fetching payment plan:', error);
    res.status(500).json({ message: 'Error fetching payment plan', error: error.message });
  }
});

// ========== Overdue Reminders ==========

// Get all overdue reminders
router.get('/reminders', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, reminder_type } = req.query;
    let query = `
      SELECT obr.*, ps.statement_number
      FROM overdue_balance_reminders obr
      LEFT JOIN patient_statements ps ON obr.statement_id = ps.id
      LEFT JOIN conversations c ON ps.conversation_id = c.id
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
      query += ` AND obr.reminder_status = $${paramCount}`;
      params.push(status);
    }

    if (reminder_type) {
      paramCount++;
      query += ` AND obr.reminder_type = $${paramCount}`;
      params.push(reminder_type);
    }

    query += ' ORDER BY obr.scheduled_send_date DESC';

    const result = await db.query(query, params);
    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ message: 'Error fetching reminders', error: error.message });
  }
});

// ========== TCPA Compliance - Do Not Call List ==========

// Get Do Not Call list
router.get('/do-not-call', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM do_not_call_list WHERE organization_id = $1 ORDER BY added_at DESC',
      [orgId]
    );

    res.json({ do_not_call_list: result.rows });
  } catch (error) {
    console.error('Error fetching Do Not Call list:', error);
    res.status(500).json({ message: 'Error fetching Do Not Call list', error: error.message });
  }
});

// Add to Do Not Call list
router.post('/do-not-call', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { phone_number, reason } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const tcpaComplianceService = require('../services/tcpaComplianceService');
    const dncRecord = await tcpaComplianceService.addToDoNotCallList(
      phone_number,
      orgId,
      reason || 'customer_request',
      req.user.id
    );

    res.status(201).json({ do_not_call: dncRecord });
  } catch (error) {
    console.error('Error adding to Do Not Call list:', error);
    res.status(500).json({ message: 'Error adding to Do Not Call list', error: error.message });
  }
});

// Remove from Do Not Call list
router.delete('/do-not-call/:phone', authenticateToken, async (req, res) => {
  try {
    const { phone } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const tcpaComplianceService = require('../services/tcpaComplianceService');
    const removed = await tcpaComplianceService.removeFromDoNotCallList(phone, orgId);

    if (!removed) {
      return res.status(404).json({ message: 'Phone number not found in Do Not Call list' });
    }

    res.json({ message: 'Removed from Do Not Call list', do_not_call: removed });
  } catch (error) {
    console.error('Error removing from Do Not Call list:', error);
    res.status(500).json({ message: 'Error removing from Do Not Call list', error: error.message });
  }
});

// ========== TCPA Compliance - Consent Records ==========

// Get consent records
router.get('/consent-records', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { patient_identifier, consent_type, consent_status } = req.query;
    let query = `
      SELECT * FROM collections_consent_records 
      WHERE organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (patient_identifier) {
      paramCount++;
      query += ` AND patient_identifier = $${paramCount}`;
      params.push(patient_identifier);
    }

    if (consent_type) {
      paramCount++;
      query += ` AND consent_type = $${paramCount}`;
      params.push(consent_type);
    }

    if (consent_status) {
      paramCount++;
      query += ` AND consent_status = $${paramCount}`;
      params.push(consent_status);
    }

    query += ' ORDER BY consent_date DESC';

    const result = await db.query(query, params);
    res.json({ consent_records: result.rows });
  } catch (error) {
    console.error('Error fetching consent records:', error);
    res.status(500).json({ message: 'Error fetching consent records', error: error.message });
  }
});

// Grant consent
router.post('/consent-records', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      patient_identifier,
      consent_type,
      consent_method,
      consent_text,
      expiration_date
    } = req.body;

    if (!patient_identifier || !consent_type) {
      return res.status(400).json({ message: 'Patient identifier and consent type are required' });
    }

    const tcpaComplianceService = require('../services/tcpaComplianceService');
    const consent = await tcpaComplianceService.grantConsent(
      {
        patient_identifier,
        consent_type,
        consent_method,
        consent_text,
        expiration_date,
        recorded_by: req.user.id
      },
      orgId
    );

    res.status(201).json({ consent_record: consent });
  } catch (error) {
    console.error('Error granting consent:', error);
    res.status(500).json({ message: 'Error granting consent', error: error.message });
  }
});

// ========== Collections Cases ==========

// Get all collections cases
router.get('/cases', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status } = req.query;
    let query = `
      SELECT cc.*, ps.statement_number
      FROM collections_cases cc
      LEFT JOIN patient_statements ps ON cc.statement_id = ps.id
      WHERE cc.organization_id = $1
    `;
    const params = [orgId];

    if (status) {
      query += ` AND cc.case_status = $2`;
      params.push(status);
    }

    query += ' ORDER BY cc.opened_at DESC';

    const result = await db.query(query, params);
    res.json({ cases: result.rows });
  } catch (error) {
    console.error('Error fetching collections cases:', error);
    res.status(500).json({ message: 'Error fetching collections cases', error: error.message });
  }
});

// ========== Collections Activity Log ==========

// Get activity log
router.get('/activity-log', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { activity_type, limit = 100 } = req.query;
    let query = `
      SELECT * FROM collections_activity_log 
      WHERE organization_id = $1
    `;
    const params = [orgId];

    if (activity_type) {
      query += ` AND activity_type = $2`;
      params.push(activity_type);
    }

    query += ' ORDER BY performed_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.json({ activity_log: result.rows });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ message: 'Error fetching activity log', error: error.message });
  }
});

module.exports = router;

