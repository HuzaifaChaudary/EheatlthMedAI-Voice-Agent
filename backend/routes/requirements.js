const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all requirements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, subcategory, requirement_type, status, search } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = 'SELECT * FROM requirements WHERE (organization_id = $1 OR (organization_id IS NULL AND $1 IS NULL))';
    const params = [orgId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (subcategory) {
      paramCount++;
      query += ` AND subcategory = $${paramCount}`;
      params.push(subcategory);
    }

    if (requirement_type) {
      paramCount++;
      query += ` AND requirement_type = $${paramCount}`;
      params.push(requirement_type);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount} OR requirement_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY requirement_id';

    const result = await db.query(query, params);
    res.json({ requirements: result.rows || [] });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ message: 'Error fetching requirements' });
  }
});

// Get requirement by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      'SELECT * FROM requirements WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))',
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Get related constraints and assumptions
    const requirement = result.rows[0];
    
    let relatedConstraints = [];
    if (requirement.related_constraints && requirement.related_constraints.length > 0) {
      const constraintsResult = await db.query(
        'SELECT * FROM constraints WHERE id = ANY($1)',
        [requirement.related_constraints]
      );
      relatedConstraints = constraintsResult.rows;
    }

    let relatedAssumptions = [];
    if (requirement.related_assumptions && requirement.related_assumptions.length > 0) {
      const assumptionsResult = await db.query(
        'SELECT * FROM operational_assumptions WHERE id = ANY($1)',
        [requirement.related_assumptions]
      );
      relatedAssumptions = assumptionsResult.rows;
    }

    // Get dependencies
    const dependenciesResult = await db.query(
      `SELECT r.*, rd.dependency_type
       FROM requirement_dependencies rd
       JOIN requirements r ON rd.depends_on_requirement_id = r.id
       WHERE rd.requirement_id = $1`,
      [id]
    );

    // Get verification history
    const verificationsResult = await db.query(
      `SELECT rv.*, u.email as verified_by_email
       FROM requirement_verifications rv
       LEFT JOIN users u ON rv.verified_by = u.id
       WHERE rv.requirement_id = $1
       ORDER BY rv.verified_at DESC`,
      [id]
    );

    res.json({
      requirement,
      related_constraints: relatedConstraints,
      related_assumptions: relatedAssumptions,
      dependencies: dependenciesResult.rows,
      verifications: verificationsResult.rows
    });
  } catch (error) {
    console.error('Error fetching requirement:', error);
    res.status(500).json({ message: 'Error fetching requirement' });
  }
});

// Create requirement
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      requirement_id,
      category,
      subcategory,
      title,
      description,
      requirement_type,
      priority,
      status,
      related_constraints,
      related_assumptions,
      parent_requirement_id,
      implementation_notes,
      verification_criteria
    } = req.body;

    // Validate required fields
    if (!requirement_id || !requirement_id.trim()) {
      return res.status(400).json({ message: 'Requirement ID is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }

    // Validate requirement_type (MUST, SHOULD, MAY)
    if (!requirement_type || !['MUST', 'SHOULD', 'MAY'].includes(requirement_type)) {
      return res.status(400).json({ message: 'Requirement type must be MUST, SHOULD, or MAY' });
    }

    // Validate priority
    if (priority && !['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ message: 'Priority must be high, medium, or low' });
    }

    // Validate status
    const validStatuses = ['draft', 'approved', 'implemented', 'verified', 'deprecated'];
    const finalStatus = status || 'draft';
    if (!validStatuses.includes(finalStatus)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO requirements (
        organization_id, requirement_id, category, subcategory, title, description,
        requirement_type, priority, status, related_constraints, related_assumptions,
        parent_requirement_id, implementation_notes, verification_criteria
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        orgId, 
        requirement_id.trim(), 
        category.trim(), 
        subcategory?.trim() || null, 
        title.trim(), 
        description.trim(),
        requirement_type, 
        priority || 'medium', 
        finalStatus,
        related_constraints || [], 
        related_assumptions || [],
        parent_requirement_id || null, 
        implementation_notes || null, 
        verification_criteria || null
      ]
    );

    res.status(201).json({ requirement: result.rows[0] });
  } catch (error) {
    console.error('Error creating requirement:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'A requirement with this ID already exists' });
    }
    res.status(500).json({ message: 'Error creating requirement', error: error.message });
  }
});

// Update requirement
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const updateFields = req.body;
    if (updateFields.requirement_type && !['MUST', 'SHOULD', 'MAY'].includes(updateFields.requirement_type)) {
      return res.status(400).json({ message: 'Requirement type must be MUST, SHOULD, or MAY' });
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
      `UPDATE requirements SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    res.json({ requirement: result.rows[0] });
  } catch (error) {
    console.error('Error updating requirement:', error);
    res.status(500).json({ message: 'Error updating requirement' });
  }
});

// Verify requirement
router.post('/:id/verify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_method, verification_result, evidence_url, notes } = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Verify requirement exists
    const reqResult = await db.query(
      'SELECT * FROM requirements WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))',
      [id, orgId]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Create verification record
    const verificationResult = await db.query(
      `INSERT INTO requirement_verifications (
        requirement_id, verified_by, verification_method, verification_result, evidence_url, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, req.user.id, verification_method, verification_result || 'passed', evidence_url, notes]
    );

    // Update requirement status if verified
    if (verification_result === 'passed') {
      await db.query(
        'UPDATE requirements SET status = $1, verified_at = CURRENT_TIMESTAMP, verified_by = $2 WHERE id = $3',
        ['verified', req.user.id, id]
      );
    }

    res.status(201).json({ verification: verificationResult.rows[0] });
  } catch (error) {
    console.error('Error verifying requirement:', error);
    res.status(500).json({ message: 'Error verifying requirement' });
  }
});

module.exports = router;

