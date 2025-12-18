const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get change control log
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, change_type } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = `
      SELECT cc.*, 
             u1.email as proposed_by_email,
             u2.email as reviewed_by_email,
             u3.email as approved_by_email
      FROM change_control_log cc
      LEFT JOIN users u1 ON cc.proposed_by = u1.id
      LEFT JOIN users u2 ON cc.reviewed_by = u2.id
      LEFT JOIN users u3 ON cc.approved_by = u3.id
      WHERE (cc.organization_id = $1 OR (cc.organization_id IS NULL AND $1 IS NULL))
    `;
    const params = [orgId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND cc.status = $${paramCount}`;
      params.push(status);
    }

    if (change_type) {
      paramCount++;
      query += ` AND cc.change_type = $${paramCount}`;
      params.push(change_type);
    }

    query += ' ORDER BY cc.created_at DESC';

    const result = await db.query(query, params);
    res.json({ changes: result.rows });
  } catch (error) {
    console.error('Error fetching change control log:', error);
    res.status(500).json({ message: 'Error fetching change control log' });
  }
});

// Create change request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      change_id,
      change_type,
      affected_documents,
      affected_requirements,
      title,
      description,
      reason,
      impact_assessment
    } = req.body;

    const result = await db.query(
      `INSERT INTO change_control_log (
        organization_id, change_id, change_type, affected_documents, affected_requirements,
        title, description, reason, impact_assessment, proposed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        orgId, change_id, change_type,
        affected_documents || [], affected_requirements || [],
        title, description, reason, impact_assessment, req.user.id
      ]
    );

    res.status(201).json({ change: result.rows[0] });
  } catch (error) {
    console.error('Error creating change request:', error);
    res.status(500).json({ message: 'Error creating change request' });
  }
});

// Review change
router.put('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body; // action: approve, reject

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const status = action === 'approve' ? 'approved' : 'rejected';

    const result = await db.query(
      `UPDATE change_control_log
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND (organization_id = $4 OR (organization_id IS NULL AND $4 IS NULL))
       RETURNING *`,
      [status, req.user.id, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Change request not found' });
    }

    res.json({ change: result.rows[0] });
  } catch (error) {
    console.error('Error reviewing change:', error);
    res.status(500).json({ message: 'Error reviewing change' });
  }
});

module.exports = router;

