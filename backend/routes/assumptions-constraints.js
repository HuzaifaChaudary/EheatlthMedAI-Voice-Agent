const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get operational assumptions
router.get('/assumptions', authenticateToken, async (req, res) => {
  try {
    const { category, search } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = orgId 
      ? 'SELECT * FROM operational_assumptions WHERE organization_id = $1'
      : 'SELECT * FROM operational_assumptions WHERE organization_id IS NULL';
    const params = orgId ? [orgId] : [];
    let paramCount = orgId ? 1 : 0;
    
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY assumption_id';

    const result = await db.query(query, params);
    res.json({ assumptions: result.rows || [] });
  } catch (error) {
    console.error('Error fetching assumptions:', error);
    res.status(500).json({ message: 'Error fetching assumptions' });
  }
});

// Get constraints
router.get('/constraints', authenticateToken, async (req, res) => {
  try {
    const { category, enforcement_level, search } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = orgId 
      ? 'SELECT * FROM constraints WHERE organization_id = $1'
      : 'SELECT * FROM constraints WHERE organization_id IS NULL';
    const params = orgId ? [orgId] : [];
    let paramCount = orgId ? 1 : 0;
    
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (enforcement_level) {
      paramCount++;
      query += ` AND enforcement_level = $${paramCount}`;
      params.push(enforcement_level);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY constraint_id';

    const result = await db.query(query, params);
    res.json({ constraints: result.rows || [] });
  } catch (error) {
    console.error('Error fetching constraints:', error);
    res.status(500).json({ message: 'Error fetching constraints' });
  }
});

// Get constraint violations
router.get('/violations', authenticateToken, async (req, res) => {
  try {
    const { resolved, severity } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = `
      SELECT cv.*, c.constraint_id, c.title as constraint_title, c.category
      FROM constraint_violations cv
      JOIN constraints c ON cv.constraint_id = c.id
      WHERE cv.organization_id ${orgId ? '= $1' : 'IS NULL'}
    `;
    const params = orgId ? [orgId] : [];
    let paramCount = orgId ? 1 : 0;

    if (resolved === 'true') {
      query += ' AND cv.resolved_at IS NOT NULL';
    } else if (resolved === 'false') {
      query += ' AND cv.resolved_at IS NULL';
    }

    if (severity) {
      paramCount++;
      query += ` AND cv.severity = $${paramCount}`;
      params.push(severity);
    }

    query += ' ORDER BY cv.detected_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json({ violations: result.rows || [] });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({ message: 'Error fetching violations' });
  }
});

// Create constraint violation
router.post('/violations', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { constraint_id, violation_type, resource_type, resource_id, severity, description } = req.body;

    // Validate required fields
    if (!constraint_id) {
      return res.status(400).json({ message: 'Constraint ID is required' });
    }
    if (!violation_type || !violation_type.trim()) {
      return res.status(400).json({ message: 'Violation type is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const result = await db.query(
      `INSERT INTO constraint_violations (
        constraint_id, organization_id, violation_type, resource_type, resource_id, severity, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [constraint_id, orgId, violation_type.trim(), resource_type || null, resource_id || null, severity || 'warning', description.trim()]
    );

    res.status(201).json({ violation: result.rows[0] });
  } catch (error) {
    console.error('Error creating violation:', error);
    res.status(500).json({ message: 'Error creating violation', error: error.message });
  }
});

// Resolve constraint violation
router.put('/violations/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      `UPDATE constraint_violations
       SET resolved_at = CURRENT_TIMESTAMP, resolved_by = $1, resolution_notes = $2
       WHERE id = $3 AND organization_id ${orgId ? '= $4' : 'IS NULL'}
       RETURNING *`,
      orgId ? [req.user.id, resolution_notes, id, orgId] : [req.user.id, resolution_notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    res.json({ violation: result.rows[0] });
  } catch (error) {
    console.error('Error resolving violation:', error);
    res.status(500).json({ message: 'Error resolving violation' });
  }
});

// Create operational assumption
router.post('/assumptions', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { assumption_id, category, title, description, impact_level } = req.body;

    // Validate required fields
    if (!assumption_id || !assumption_id.trim()) {
      return res.status(400).json({ message: 'Assumption ID is required' });
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

    // Validate impact_level
    if (impact_level && !['high', 'medium', 'low'].includes(impact_level)) {
      return res.status(400).json({ message: 'Impact level must be high, medium, or low' });
    }

    const result = await db.query(
      `INSERT INTO operational_assumptions (
        organization_id, assumption_id, category, title, description, impact_level
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [orgId, assumption_id.trim(), category.trim(), title.trim(), description.trim(), impact_level || 'medium']
    );

    res.status(201).json({ assumption: result.rows[0] });
  } catch (error) {
    console.error('Error creating assumption:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'An assumption with this ID already exists' });
    }
    res.status(500).json({ message: 'Error creating assumption', error: error.message });
  }
});

// Create constraint
router.post('/constraints', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { constraint_id, category, title, description, constraint_type, enforcement_level } = req.body;

    // Validate required fields
    if (!constraint_id || !constraint_id.trim()) {
      return res.status(400).json({ message: 'Constraint ID is required' });
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

    // Validate constraint_type
    if (constraint_type && !['technical', 'legal', 'operational', 'regulatory'].includes(constraint_type)) {
      return res.status(400).json({ message: 'Constraint type must be technical, legal, operational, or regulatory' });
    }

    // Validate enforcement_level
    if (enforcement_level && !['mandatory', 'recommended', 'optional'].includes(enforcement_level)) {
      return res.status(400).json({ message: 'Enforcement level must be mandatory, recommended, or optional' });
    }

    const result = await db.query(
      `INSERT INTO constraints (
        organization_id, constraint_id, category, title, description, constraint_type, enforcement_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        orgId, 
        constraint_id.trim(), 
        category.trim(), 
        title.trim(), 
        description.trim(), 
        constraint_type || 'technical',
        enforcement_level || 'mandatory'
      ]
    );

    res.status(201).json({ constraint: result.rows[0] });
  } catch (error) {
    console.error('Error creating constraint:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'A constraint with this ID already exists' });
    }
    res.status(500).json({ message: 'Error creating constraint', error: error.message });
  }
});

module.exports = router;

