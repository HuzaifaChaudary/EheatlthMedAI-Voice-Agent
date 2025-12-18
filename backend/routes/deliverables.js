const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get deliverables
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, status, priority } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    let query = `
      SELECT d.*, u.email as assigned_to_email
      FROM deliverables d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND d.category = $${paramCount}`;
      params.push(category);
    }

    if (status) {
      paramCount++;
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND d.priority = $${paramCount}`;
      params.push(priority);
    }

    query += ' ORDER BY d.priority DESC, d.due_date ASC';

    const result = await db.query(query, params);

    // Get milestones for each deliverable
    for (const deliverable of result.rows) {
      const milestonesResult = await db.query(
        'SELECT * FROM deliverable_milestones WHERE deliverable_id = $1 ORDER BY created_at',
        [deliverable.id]
      );
      deliverable.milestones = milestonesResult.rows;
    }

    res.json({ deliverables: result.rows });
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    res.status(500).json({ message: 'Error fetching deliverables' });
  }
});

// Get deliverable by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      `SELECT d.*, u.email as assigned_to_email
       FROM deliverables d
       LEFT JOIN users u ON d.assigned_to = u.id
       WHERE d.id = $1 AND d.organization_id = $2`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deliverable not found' });
    }

    const deliverable = result.rows[0];

    // Get milestones
    const milestonesResult = await db.query(
      'SELECT * FROM deliverable_milestones WHERE deliverable_id = $1 ORDER BY created_at',
      [id]
    );
    deliverable.milestones = milestonesResult.rows;

    res.json({ deliverable });
  } catch (error) {
    console.error('Error fetching deliverable:', error);
    res.status(500).json({ message: 'Error fetching deliverable' });
  }
});

// Create deliverable
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const {
      deliverable_id,
      title,
      description,
      category,
      priority,
      assigned_to,
      assigned_to_email,
      due_date,
      dependencies,
      related_requirements,
      related_documents,
      acceptance_criteria,
      status
    } = req.body;

    // Look up user ID from email if provided
    let userId = assigned_to;
    if (assigned_to_email && !assigned_to) {
      const userResult = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [assigned_to_email]
      );
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    const result = await db.query(
      `INSERT INTO deliverables (
        organization_id, deliverable_id, title, description, category, priority, status,
        assigned_to, due_date, dependencies, related_requirements, related_documents, acceptance_criteria
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        orgId, deliverable_id, title, description, category, priority, status || 'planned',
        userId || null, due_date || null, dependencies || [], related_requirements || [],
        related_documents || [], acceptance_criteria || null
      ]
    );

    res.status(201).json({ deliverable: result.rows[0] });
  } catch (error) {
    console.error('Error creating deliverable:', error);
    res.status(500).json({ message: 'Error creating deliverable' });
  }
});

// Update deliverable
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const updateFields = req.body;
    if (updateFields.status === 'completed' && !updateFields.completed_date) {
      updateFields.completed_date = new Date().toISOString().split('T')[0];
    }

    const setClause = Object.keys(updateFields)
      .filter(key => key !== 'id')
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');

    if (!setClause) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const values = [id, orgId, ...Object.values(updateFields).filter((_, idx) => Object.keys(updateFields)[idx] !== 'id')];

    const result = await db.query(
      `UPDATE deliverables SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deliverable not found' });
    }

    res.json({ deliverable: result.rows[0] });
  } catch (error) {
    console.error('Error updating deliverable:', error);
    res.status(500).json({ message: 'Error updating deliverable' });
  }
});

// Add milestone
router.post('/:id/milestones', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { milestone_name, description } = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Verify deliverable belongs to organization
    const deliverableResult = await db.query(
      'SELECT id FROM deliverables WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );

    if (deliverableResult.rows.length === 0) {
      return res.status(404).json({ message: 'Deliverable not found' });
    }

    const result = await db.query(
      `INSERT INTO deliverable_milestones (deliverable_id, milestone_name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, milestone_name, description]
    );

    res.status(201).json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ message: 'Error creating milestone' });
  }
});

module.exports = router;

