/**
 * Billing Specialist Routes
 * API endpoints for statements, payments, receipts, and insurance
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== Patient Statements ==========

// Get all statements
router.get('/statements', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, patient_name, patient_email } = req.query;
    let query = `
      SELECT ps.*, c.agent_id, a.name as agent_name, a.type as agent_type
      FROM patient_statements ps
      LEFT JOIN conversations c ON ps.conversation_id = c.id
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
      query += ` AND ps.status = $${paramCount}`;
      params.push(status);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND ps.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    if (patient_email) {
      paramCount++;
      query += ` AND ps.patient_email = $${paramCount}`;
      params.push(patient_email);
    }

    query += ' ORDER BY ps.statement_date DESC';

    const result = await db.query(query, params);
    res.json({ statements: result.rows });
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({ message: 'Error fetching statements', error: error.message });
  }
});

// Get statement by ID
router.get('/statements/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = `
      SELECT ps.*, 
             (SELECT json_agg(json_build_object(
               'id', sli.id,
               'description', sli.item_description,
               'service_date', sli.service_date,
               'quantity', sli.quantity,
               'unit_price', sli.unit_price,
               'total_price', sli.total_price,
               'insurance_paid', sli.insurance_paid,
               'patient_responsible', sli.patient_responsible
             )) FROM statement_line_items sli WHERE sli.statement_id = ps.id) as line_items
      FROM patient_statements ps
      LEFT JOIN conversations c ON ps.conversation_id = c.id
      WHERE ps.id = $1
    `;
    const params = [id];

    if (orgId) {
      query += ` AND (c.organization_id = $2 OR c.organization_id IS NULL)`;
      params.push(orgId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Statement not found' });
    }

    res.json({ statement: result.rows[0] });
  } catch (error) {
    console.error('Error fetching statement:', error);
    res.status(500).json({ message: 'Error fetching statement', error: error.message });
  }
});

// ========== Payments ==========

// Get all payments
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { status, patient_name, statement_id } = req.query;
    let query = `
      SELECT p.*, ps.statement_number, c.agent_id, a.name as agent_name
      FROM payments p
      LEFT JOIN patient_statements ps ON p.statement_id = ps.id
      LEFT JOIN conversations c ON p.conversation_id = c.id
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
      query += ` AND p.payment_status = $${paramCount}`;
      params.push(status);
    }

    if (patient_name) {
      paramCount++;
      query += ` AND p.patient_name ILIKE $${paramCount}`;
      params.push(`%${patient_name}%`);
    }

    if (statement_id) {
      paramCount++;
      query += ` AND p.statement_id = $${paramCount}`;
      params.push(statement_id);
    }

    query += ' ORDER BY p.payment_date DESC';

    const result = await db.query(query, params);
    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
});

// ========== Payment Receipts ==========

// Get all receipts
router.get('/receipts', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { payment_id, patient_email } = req.query;
    let query = `
      SELECT pr.*, p.payment_amount, p.payment_method, p.payment_date
      FROM payment_receipts pr
      LEFT JOIN payments p ON pr.payment_id = p.id
      LEFT JOIN conversations c ON p.conversation_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (orgId) {
      paramCount++;
      query += ` AND (c.organization_id = $${paramCount} OR c.organization_id IS NULL)`;
      params.push(orgId);
    }

    if (payment_id) {
      paramCount++;
      query += ` AND pr.payment_id = $${paramCount}`;
      params.push(payment_id);
    }

    if (patient_email) {
      paramCount++;
      query += ` AND pr.patient_email = $${paramCount}`;
      params.push(patient_email);
    }

    query += ' ORDER BY pr.receipt_date DESC';

    const result = await db.query(query, params);
    res.json({ receipts: result.rows });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ message: 'Error fetching receipts', error: error.message });
  }
});

// Download receipt PDF
router.get('/receipts/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const receiptResult = await db.query(
      `SELECT pr.*, p.conversation_id, c.organization_id
       FROM payment_receipts pr
       LEFT JOIN payments p ON pr.payment_id = p.id
       LEFT JOIN conversations c ON p.conversation_id = c.id
       WHERE pr.id = $1 AND (c.organization_id = $2 OR c.organization_id IS NULL)`,
      [id, orgId]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];
    const path = require('path');
    const fs = require('fs');

    const filepath = path.join(__dirname, '../../receipts', path.basename(receipt.receipt_pdf_url));

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Receipt file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receipt_number}.pdf"`);
    res.sendFile(filepath);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ message: 'Error downloading receipt', error: error.message });
  }
});

// ========== Insurance Information ==========

// Get patient insurance information
router.get('/insurance/:patientIdentifier', authenticateToken, async (req, res) => {
  try {
    const { patientIdentifier } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      `SELECT * FROM insurance_information 
       WHERE patient_identifier = $1 
       AND (organization_id = $2 OR organization_id IS NULL)
       AND is_active = true
       ORDER BY organization_id DESC NULLS LAST, effective_date DESC`,
      [patientIdentifier, orgId]
    );

    res.json({ insurance: result.rows });
  } catch (error) {
    console.error('Error fetching insurance information:', error);
    res.status(500).json({ message: 'Error fetching insurance information', error: error.message });
  }
});

// Create/update insurance information
router.post('/insurance', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      patient_identifier,
      insurance_provider,
      policy_number,
      group_number,
      member_id,
      coverage_type,
      effective_date,
      expiration_date,
      copay_amount,
      deductible_amount,
      coinsurance_percentage,
      out_of_pocket_maximum,
      coverage_details
    } = req.body;

    if (!patient_identifier || !insurance_provider) {
      return res.status(400).json({ message: 'Patient identifier and insurance provider are required' });
    }

    const result = await db.query(
      `INSERT INTO insurance_information (
        organization_id, patient_identifier, insurance_provider, policy_number,
        group_number, member_id, coverage_type, effective_date, expiration_date,
        copay_amount, deductible_amount, coinsurance_percentage, out_of_pocket_maximum,
        coverage_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        orgId,
        patient_identifier,
        insurance_provider,
        policy_number || null,
        group_number || null,
        member_id || null,
        coverage_type || 'primary',
        effective_date || null,
        expiration_date || null,
        copay_amount || null,
        deductible_amount || null,
        coinsurance_percentage || null,
        out_of_pocket_maximum || null,
        coverage_details ? JSON.stringify(coverage_details) : null
      ]
    );

    res.status(201).json({ insurance: result.rows[0] });
  } catch (error) {
    console.error('Error creating insurance information:', error);
    res.status(500).json({ message: 'Error creating insurance information', error: error.message });
  }
});

// ========== Insurance QA Knowledge Base ==========

// Get insurance Q&A
router.get('/insurance-qa', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { category } = req.query;
    let query = `
      SELECT * FROM insurance_qa_knowledge_base 
      WHERE (organization_id = $1 OR organization_id IS NULL)
      AND is_active = true
    `;
    const params = [orgId];

    if (category) {
      query += ` AND question_category = $2`;
      params.push(category);
    }

    query += ' ORDER BY question_category, question';

    const result = await db.query(query, params);
    res.json({ qa: result.rows });
  } catch (error) {
    console.error('Error fetching insurance Q&A:', error);
    res.status(500).json({ message: 'Error fetching insurance Q&A', error: error.message });
  }
});

// Create insurance Q&A
router.post('/insurance-qa', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      question_category,
      question,
      answer,
      related_keywords
    } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required' });
    }

    const result = await db.query(
      `INSERT INTO insurance_qa_knowledge_base (
        organization_id, question_category, question, answer, related_keywords
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        orgId,
        question_category || 'general',
        question,
        answer,
        related_keywords || []
      ]
    );

    res.status(201).json({ qa: result.rows[0] });
  } catch (error) {
    console.error('Error creating insurance Q&A:', error);
    res.status(500).json({ message: 'Error creating insurance Q&A', error: error.message });
  }
});

// ========== Payment Gateway Configurations ==========

// Get payment gateway configs
router.get('/payment-gateways', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT id, gateway_name, gateway_type, is_active, is_test_mode, created_at FROM payment_gateway_configs WHERE organization_id = $1 OR organization_id IS NULL ORDER BY gateway_name',
      [orgId]
    );

    res.json({ gateways: result.rows });
  } catch (error) {
    console.error('Error fetching payment gateways:', error);
    res.status(500).json({ message: 'Error fetching payment gateways', error: error.message });
  }
});

// Create payment gateway config
router.post('/payment-gateways', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      gateway_name,
      gateway_type,
      api_key,
      api_secret,
      webhook_secret,
      merchant_id,
      is_test_mode,
      configuration
    } = req.body;

    if (!gateway_name || !gateway_type || !api_key) {
      return res.status(400).json({ message: 'Gateway name, type, and API key are required' });
    }

    // In production, encrypt these fields
    const result = await db.query(
      `INSERT INTO payment_gateway_configs (
        organization_id, gateway_name, gateway_type, api_key_encrypted,
        api_secret_encrypted, webhook_secret_encrypted, merchant_id,
        is_test_mode, configuration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, gateway_name, gateway_type, is_active, is_test_mode, created_at`,
      [
        orgId,
        gateway_name,
        gateway_type,
        api_key, // In production, encrypt this
        api_secret || null, // In production, encrypt this
        webhook_secret || null, // In production, encrypt this
        merchant_id || null,
        is_test_mode !== false,
        configuration ? JSON.stringify(configuration) : null
      ]
    );

    res.status(201).json({ gateway: result.rows[0] });
  } catch (error) {
    console.error('Error creating payment gateway config:', error);
    res.status(500).json({ message: 'Error creating payment gateway config', error: error.message });
  }
});

module.exports = router;

