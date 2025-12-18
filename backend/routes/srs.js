const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get SRS documents
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { section, status, version } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = 'SELECT * FROM srs_documents WHERE (organization_id = $1 OR (organization_id IS NULL AND $1 IS NULL))';
    const params = [orgId];
    let paramCount = 1;

    if (section) {
      paramCount++;
      query += ` AND section = $${paramCount}`;
      params.push(section);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (version) {
      paramCount++;
      query += ` AND version = $${paramCount}`;
      params.push(version);
    }

    query += ' ORDER BY section, document_id';

    const result = await db.query(query, params);
    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Error fetching SRS documents:', error);
    res.status(500).json({ message: error.message || 'Error fetching SRS documents' });
  }
});

// Get SRS document by ID
router.get('/documents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM srs_documents WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))',
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Get version history
    const versionsResult = await db.query(
      'SELECT * FROM srs_versions WHERE document_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get approval records
    const approvalsResult = await db.query(
      `SELECT ar.*, u.email as approver_email
       FROM approval_records ar
       LEFT JOIN users u ON ar.approver_id = u.id
       WHERE ar.entity_type = 'srs_document' AND ar.entity_id = $1
       ORDER BY ar.step_number`,
      [id]
    );

    res.json({
      document: result.rows[0],
      versions: versionsResult.rows,
      approvals: approvalsResult.rows
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document' });
  }
});

// Create/Update SRS document
router.post('/documents', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      document_id,
      title,
      section,
      subsection,
      content,
      version
    } = req.body;

    // Check if document exists
    const existingResult = await db.query(
      'SELECT id, version FROM srs_documents WHERE document_id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))',
      [document_id, orgId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing - create new version
      const existing = existingResult.rows[0];
      const newVersion = version || incrementVersion(existing.version);

      // Save old version to history
      await db.query(
        'INSERT INTO srs_versions (document_id, version, changed_by) VALUES ($1, $2, $3)',
        [existing.id, existing.version, req.user.id]
      );

      // Update document
      const updateResult = await db.query(
        `UPDATE srs_documents 
         SET title = $1, section = $2, subsection = $3, content = $4, version = $5,
             status = 'draft', updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [title, section, subsection, content, newVersion, existing.id]
      );

      res.json({ document: updateResult.rows[0] });
    } else {
      // Create new
      const result = await db.query(
        `INSERT INTO srs_documents (organization_id, document_id, title, section, subsection, content, version, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [orgId, document_id, title, section, subsection, content, version || '1.0', req.user.id]
      );

      res.status(201).json({ document: result.rows[0] });
    }
  } catch (error) {
    console.error('Error creating/updating document:', error);
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: `Document ID "${document_id}" already exists. Please use a different ID.` });
    }
    
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ message: 'Invalid organization or user reference.' });
    }
    
    res.status(500).json({ message: error.message || 'Error creating/updating document' });
  }
});

// Submit for approval
router.post('/documents/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Get workflow
    const workflowResult = await db.query(
      'SELECT * FROM approval_workflows WHERE organization_id = $1 AND workflow_type = $2 AND is_active = true LIMIT 1',
      [orgId, 'srs_approval']
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ message: 'Approval workflow not found' });
    }

    const workflow = workflowResult.rows[0];
    const steps = workflow.steps;

    // Update document status
    await db.query(
      'UPDATE srs_documents SET status = $1 WHERE id = $2',
      ['in_review', id]
    );

    // Create approval records for each step
    for (const step of steps) {
      await db.query(
        `INSERT INTO approval_records (workflow_id, entity_type, entity_id, step_number, approver_role, status)
         VALUES ($1, 'srs_document', $2, $3, $4, 'pending')`,
        [workflow.id, id, step.step, step.role]
      );
    }

    res.json({ message: 'Document submitted for approval' });
  } catch (error) {
    console.error('Error submitting for approval:', error);
    res.status(500).json({ message: 'Error submitting for approval' });
  }
});

// Approve document step
router.post('/documents/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { step_number, comments, action } = req.body; // action: approve, reject

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Update approval record
    await db.query(
      `UPDATE approval_records
       SET status = $1, approver_id = $2, comments = $3, approved_at = CURRENT_TIMESTAMP
       WHERE entity_type = 'srs_document' AND entity_id = $4 AND step_number = $5`,
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, comments, id, step_number]
    );

    if (action === 'approve') {
      // Check if all steps are approved
      const pendingResult = await db.query(
        `SELECT COUNT(*) FROM approval_records
         WHERE entity_type = 'srs_document' AND entity_id = $1 AND status = 'pending'`,
        [id]
      );

      if (parseInt(pendingResult.rows[0].count) === 0) {
        // All approved - update document status
        await db.query(
          `UPDATE srs_documents 
           SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [req.user.id, id]
        );
      }
    } else {
      // Rejected - update document status
      await db.query(
        'UPDATE srs_documents SET status = $1 WHERE id = $2',
        ['draft', id]
      );
    }

    res.json({ message: `Document ${action === 'approve' ? 'approved' : 'rejected'}` });
  } catch (error) {
    console.error('Error approving document:', error);
    res.status(500).json({ message: 'Error approving document' });
  }
});

// Get SRS section templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM srs_section_templates ORDER BY section');
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Error fetching templates' });
  }
});

// Helper function to increment version
function incrementVersion(version) {
  const parts = version.split('.');
  const minor = parseInt(parts[parts.length - 1]) + 1;
  parts[parts.length - 1] = minor.toString();
  return parts.join('.');
}

module.exports = router;

