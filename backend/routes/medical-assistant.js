/**
 * Medical Assistant Routes
 * API endpoints for medication refills, lab results, intake forms, and prep instructions
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const medicationRefillService = require('../services/medicationRefillService');
const labResultsService = require('../services/labResultsService');
const preVisitIntakeService = require('../services/preVisitIntakeService');
const prepInstructionsService = require('../services/prepInstructionsService');
const router = express.Router();

// ========== Medication Refill Requests ==========

// Get all medication refill requests
router.get('/medication-refills', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, patient_name } = req.query;
    let query = `
      SELECT mrr.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM medication_refill_requests mrr
      LEFT JOIN conversations c ON mrr.conversation_id = c.id
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
      query += ` AND mrr.status = $${paramCount}`;
      params.push(status);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND mrr.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    query += ' ORDER BY mrr.refill_request_date DESC';

    const result = await db.query(query, params);
    res.json({ refill_requests: result.rows });
  } catch (error) {
    console.error('Error fetching medication refill requests:', error);
    res.status(500).json({ message: 'Error fetching medication refill requests', error: error.message });
  }
});

// Update refill request status (approve/deny)
router.put('/medication-refills/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, provider_notes } = req.body;

    if (!['approved', 'denied', 'requires_provider_review'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE medication_refill_requests 
       SET status = $1, provider_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, provider_notes || null, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Refill request not found' });
    }

    res.json({ refill_request: result.rows[0] });
  } catch (error) {
    console.error('Error updating refill request status:', error);
    res.status(500).json({ message: 'Error updating refill request status', error: error.message });
  }
});

// ========== Lab Results ==========

// Get all lab results
router.get('/lab-results', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { test_name, status, patient_name } = req.query;
    let query = `
      SELECT lr.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM lab_results lr
      LEFT JOIN conversations c ON lr.conversation_id = c.id
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

    if (test_name) {
      paramCount++;
      query += ` AND lr.test_name ILIKE $${paramCount}`;
      params.push(`%${test_name}%`);
    }

    if (status) {
      paramCount++;
      query += ` AND lr.status = $${paramCount}`;
      params.push(status);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND lr.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    query += ' ORDER BY lr.test_date DESC, lr.created_at DESC';

    const result = await db.query(query, params);
    res.json({ lab_results: result.rows });
  } catch (error) {
    console.error('Error fetching lab results:', error);
    res.status(500).json({ message: 'Error fetching lab results', error: error.message });
  }
});

// ========== Pre-Visit Intake Forms ==========

// Get all intake forms
router.get('/intake-forms', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, form_type, appointment_id } = req.query;
    let query = `
      SELECT ivf.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM pre_visit_intake_forms ivf
      LEFT JOIN conversations c ON ivf.conversation_id = c.id
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
      query += ` AND ivf.status = $${paramCount}`;
      params.push(status);
    }

    if (form_type) {
      paramCount++;
      query += ` AND ivf.form_type = $${paramCount}`;
      params.push(form_type);
    }

    if (appointment_id) {
      paramCount++;
      query += ` AND ivf.appointment_id = $${paramCount}`;
      params.push(appointment_id);
    }

    query += ' ORDER BY ivf.created_at DESC';

    const result = await db.query(query, params);
    res.json({ intake_forms: result.rows });
  } catch (error) {
    console.error('Error fetching intake forms:', error);
    res.status(500).json({ message: 'Error fetching intake forms', error: error.message });
  }
});

// ========== Prep Instructions ==========

// Get all prep instructions sent
router.get('/prep-instructions', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { instruction_type, appointment_id } = req.query;
    let query = `
      SELECT pis.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM prep_instructions_sent pis
      LEFT JOIN conversations c ON pis.conversation_id = c.id
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

    if (instruction_type) {
      paramCount++;
      query += ` AND pis.instruction_type = $${paramCount}`;
      params.push(instruction_type);
    }

    if (appointment_id) {
      paramCount++;
      query += ` AND pis.appointment_id = $${paramCount}`;
      params.push(appointment_id);
    }

    query += ' ORDER BY pis.sent_at DESC';

    const result = await db.query(query, params);
    res.json({ prep_instructions: result.rows });
  } catch (error) {
    console.error('Error fetching prep instructions:', error);
    res.status(500).json({ message: 'Error fetching prep instructions', error: error.message });
  }
});

// ========== Prep Instruction Templates ==========

// Get prep instruction templates
router.get('/prep-templates', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM prep_instruction_templates WHERE organization_id = $1 OR organization_id IS NULL ORDER BY instruction_type',
      [orgId]
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching prep templates:', error);
    res.status(500).json({ message: 'Error fetching prep templates', error: error.message });
  }
});

// Create prep instruction template
router.post('/prep-templates', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      instruction_type,
      title,
      instructions,
      timing_hours_before,
      send_via_sms,
      send_via_email
    } = req.body;

    if (!instruction_type || !title || !instructions) {
      return res.status(400).json({ message: 'Instruction type, title, and instructions are required' });
    }

    const result = await db.query(
      `INSERT INTO prep_instruction_templates (
        organization_id, instruction_type, title, instructions,
        timing_hours_before, send_via_sms, send_via_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        orgId,
        instruction_type,
        title,
        instructions,
        timing_hours_before || null,
        send_via_sms !== false,
        send_via_email !== false
      ]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error creating prep template:', error);
    res.status(500).json({ message: 'Error creating prep template', error: error.message });
  }
});

// ========== EMR Medication History Integration ==========

// Get medication history from EMR for a patient
router.get('/medication-history/:patientIdentifier', authenticateToken, async (req, res) => {
  try {
    const { patientIdentifier } = req.params;
    const { ehr_system_id } = req.query;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!ehr_system_id) {
      return res.status(400).json({ message: 'ehr_system_id is required' });
    }

    const emrMedicationService = require('../services/emrMedicationService');
    const medications = await emrMedicationService.getMedicationHistory(
      patientIdentifier,
      ehr_system_id,
      orgId
    );

    res.json({ medications });
  } catch (error) {
    console.error('Error fetching medication history:', error);
    res.status(500).json({ message: 'Error fetching medication history', error: error.message });
  }
});

// ========== Lab Systems Results Retrieval ==========

// Get lab results from lab system for a patient
router.get('/lab-results/:patientIdentifier', authenticateToken, async (req, res) => {
  try {
    const { patientIdentifier } = req.params;
    const { lab_system_id, start_date, end_date } = req.query;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!lab_system_id) {
      return res.status(400).json({ message: 'lab_system_id is required' });
    }

    const labSystemsService = require('../services/labSystemsService');
    const dateRange = (start_date || end_date) ? { start: start_date, end: end_date } : null;
    
    const results = await labSystemsService.getLabResults(
      patientIdentifier,
      lab_system_id,
      orgId,
      dateRange
    );

    res.json({ lab_results: results });
  } catch (error) {
    console.error('Error fetching lab results:', error);
    res.status(500).json({ message: 'Error fetching lab results', error: error.message });
  }
});

module.exports = router;

