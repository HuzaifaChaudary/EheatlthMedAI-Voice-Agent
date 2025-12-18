const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const baaTemplateService = require('../services/baaTemplateService');
const router = express.Router();

// Get BAA agreements
router.get('/baa', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM baa_agreements WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ agreements: result.rows });
  } catch (error) {
    console.error('Error fetching BAA agreements:', error);
    res.status(500).json({ message: 'Error fetching BAA agreements' });
  }
});

// Create BAA agreement
router.post('/baa', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { vendor_name, vendor_type, status, signed_date, expiration_date, document_url, notes } = req.body;

    const result = await db.query(
      `INSERT INTO baa_agreements (organization_id, vendor_name, vendor_type, status, signed_date, expiration_date, document_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [orgId, vendor_name, vendor_type, status, signed_date, expiration_date, document_url, notes]
    );

    res.status(201).json({ agreement: result.rows[0] });
  } catch (error) {
    console.error('Error creating BAA agreement:', error);
    res.status(500).json({ message: 'Error creating BAA agreement' });
  }
});

// Get retention policies
router.get('/retention', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM retention_policies WHERE organization_id = $1 ORDER BY data_type',
      [orgId]
    );

    res.json({ policies: result.rows });
  } catch (error) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({ message: 'Error fetching retention policies' });
  }
});

// Update retention policy
router.put('/retention/:data_type', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;
    const { data_type } = req.params;
    const { retention_days, auto_delete } = req.body;

    const result = await db.query(
      `INSERT INTO retention_policies (organization_id, data_type, retention_days, auto_delete)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, data_type)
       DO UPDATE SET retention_days = EXCLUDED.retention_days,
                      auto_delete = EXCLUDED.auto_delete,
                      updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orgId, data_type, retention_days, auto_delete]
    );

    res.json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Error updating retention policy:', error);
    res.status(500).json({ message: 'Error updating retention policy' });
  }
});

// Generate BAA template
router.post('/baa/generate-template', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;
    const { vendor_name, vendor_type } = req.body;

    if (!vendor_name) {
      return res.status(400).json({ message: 'Vendor name is required' });
    }

    const result = await baaTemplateService.generateAndSave(
      orgId,
      vendor_name,
      vendor_type || 'services',
      req.user.id
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error generating BAA template:', error);
    res.status(500).json({ message: 'Error generating BAA template', error: error.message });
  }
});

// Get BAA document template
router.get('/baa/document/:agreementId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM baa_agreements WHERE id = $1 AND organization_id = $2',
      [req.params.agreementId, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'BAA agreement not found' });
    }

    const agreement = result.rows[0];
    const template = baaTemplateService.generateTemplate(
      null,
      agreement.vendor_name,
      agreement.vendor_type
    );

    res.setHeader('Content-Type', 'text/plain');
    res.send(template);
  } catch (error) {
    console.error('Error fetching BAA document:', error);
    res.status(500).json({ message: 'Error fetching BAA document' });
  }
});

// Export audit trail
router.get('/audit/export', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;
    const { start_date, end_date, format = 'json' } = req.query;

    let query = `
      SELECT al.*, u.email as user_email, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (start_date) {
      paramCount++;
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(end_date);
    }

    query += ' ORDER BY al.created_at DESC';

    const result = await db.query(query, params);

    if (format === 'csv') {
      const csv = [
        'ID,User Email,User Name,Action,Resource Type,Resource ID,IP Address,Created At,Details',
        ...result.rows.map(row => [
          row.id,
          row.user_email || '',
          row.user_name || '',
          row.action,
          row.resource_type || '',
          row.resource_id || '',
          row.ip_address || '',
          row.created_at,
          (row.details || '').replace(/"/g, '""')
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({
        total_records: result.rows.length,
        start_date: start_date || null,
        end_date: end_date || null,
        exported_at: new Date().toISOString(),
        records: result.rows
      });
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, details) VALUES ($1, $2, $3, $4)',
      [
        req.user.id,
        'EXPORT_AUDIT_TRAIL',
        'audit_logs',
        JSON.stringify({ format, record_count: result.rows.length })
      ]
    );
  } catch (error) {
    console.error('Error exporting audit trail:', error);
    res.status(500).json({ message: 'Error exporting audit trail', error: error.message });
  }
});

module.exports = router;

