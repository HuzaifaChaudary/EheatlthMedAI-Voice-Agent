const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all reference standards
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, stakeholder, code } = req.query;

    let query = 'SELECT * FROM reference_standards WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (code) {
      paramCount++;
      query += ` AND code = $${paramCount}`;
      params.push(code);
    }

    if (stakeholder) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(stakeholder_relevance)`;
      params.push(stakeholder);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);

    res.json({ references: result.rows });
  } catch (error) {
    console.error('Error fetching references:', error);
    res.status(500).json({ message: 'Error fetching references' });
  }
});

// Get reference by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM reference_standards WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reference not found' });
    }

    res.json({ reference: result.rows[0] });
  } catch (error) {
    console.error('Error fetching reference:', error);
    res.status(500).json({ message: 'Error fetching reference' });
  }
});

module.exports = router;

