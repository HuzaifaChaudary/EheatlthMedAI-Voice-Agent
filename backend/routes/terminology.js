const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all terminology
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, stakeholder } = req.query;

    let query = 'SELECT * FROM terminology WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (term ILIKE $${paramCount} OR acronym ILIKE $${paramCount} OR definition ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (stakeholder) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(stakeholder_relevance)`;
      params.push(stakeholder);
    }

    query += ' ORDER BY term';

    const result = await db.query(query, params);

    res.json({ terminology: result.rows });
  } catch (error) {
    console.error('Error fetching terminology:', error);
    res.status(500).json({ message: 'Error fetching terminology' });
  }
});

// Get terminology by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM terminology WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Term not found' });
    }

    // Get related terms if any
    let relatedTerms = [];
    if (result.rows[0].related_terms && result.rows[0].related_terms.length > 0) {
      const relatedResult = await db.query(
        'SELECT id, term, acronym, definition FROM terminology WHERE id = ANY($1)',
        [result.rows[0].related_terms]
      );
      relatedTerms = relatedResult.rows;
    }

    res.json({
      term: result.rows[0],
      related_terms: relatedTerms
    });
  } catch (error) {
    console.error('Error fetching term:', error);
    res.status(500).json({ message: 'Error fetching term' });
  }
});

// Search terminology
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const result = await db.query(
      `SELECT * FROM terminology 
       WHERE term ILIKE $1 OR acronym ILIKE $1 OR definition ILIKE $1
       ORDER BY 
         CASE WHEN term ILIKE $1 THEN 1 ELSE 2 END,
         term
       LIMIT 20`,
      [`%${query}%`]
    );

    res.json({ results: result.rows });
  } catch (error) {
    console.error('Error searching terminology:', error);
    res.status(500).json({ message: 'Error searching terminology' });
  }
});

module.exports = router;

