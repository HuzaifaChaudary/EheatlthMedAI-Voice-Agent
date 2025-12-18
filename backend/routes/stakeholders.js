const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all stakeholder types
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stakeholder_types ORDER BY name');
    res.json({ stakeholder_types: result.rows });
  } catch (error) {
    console.error('Error fetching stakeholder types:', error);
    res.status(500).json({ message: 'Error fetching stakeholder types' });
  }
});

// Get reading guidance for a stakeholder type
router.get('/:stakeholderType/guidance', authenticateToken, async (req, res) => {
  try {
    const { stakeholderType } = req.params;

    const stakeholderResult = await db.query(
      'SELECT id, code, name FROM stakeholder_types WHERE code = $1',
      [stakeholderType]
    );

    if (stakeholderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Stakeholder type not found' });
    }

    const stakeholder = stakeholderResult.rows[0];

    const guidanceResult = await db.query(
      `SELECT rg.*, 
              COALESCE(
                (SELECT json_agg(json_build_object('id', rs.id, 'code', rs.code, 'name', rs.name))
                 FROM reference_standards rs 
                 WHERE rs.id = ANY(rg.related_references)),
                '[]'::json
              ) as references
       FROM reading_guidance rg
       WHERE rg.stakeholder_type_id = $1
       ORDER BY 
         CASE rg.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         rg.section`,
      [stakeholder.id]
    );

    res.json({
      stakeholder,
      guidance: guidanceResult.rows
    });
  } catch (error) {
    console.error('Error fetching reading guidance:', error);
    res.status(500).json({ message: 'Error fetching reading guidance' });
  }
});

// Get user's stakeholder types and relevant content
router.get('/me/content', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT stakeholder_types FROM users WHERE id = $1',
      [req.user.id]
    );

    const stakeholderTypes = userResult.rows[0]?.stakeholder_types || [];

    // Get relevant terminology
    const terminologyResult = await db.query(
      `SELECT DISTINCT t.* 
       FROM terminology t
       WHERE t.stakeholder_relevance && $1::TEXT[]
       ORDER BY t.term`,
      [stakeholderTypes]
    );

    // Get relevant references
    const referencesResult = await db.query(
      `SELECT DISTINCT r.* 
       FROM reference_standards r
       WHERE r.stakeholder_relevance && $1::TEXT[]
       ORDER BY r.name`,
      [stakeholderTypes]
    );

    // Get reading guidance
    const guidancePromises = stakeholderTypes.map(async (stakeholderCode) => {
      const stakeholderResult = await db.query(
        'SELECT id FROM stakeholder_types WHERE code = $1',
        [stakeholderCode]
      );

      if (stakeholderResult.rows.length === 0) return null;

      const guidanceResult = await db.query(
        'SELECT * FROM reading_guidance WHERE stakeholder_type_id = $1 ORDER BY priority, section',
        [stakeholderResult.rows[0].id]
      );

      return {
        stakeholder: stakeholderCode,
        guidance: guidanceResult.rows
      };
    });

    const guidanceResults = await Promise.all(guidancePromises);

    res.json({
      stakeholder_types: stakeholderTypes,
      terminology: terminologyResult.rows,
      references: referencesResult.rows,
      reading_guidance: guidanceResults.filter(g => g !== null)
    });
  } catch (error) {
    console.error('Error fetching stakeholder content:', error);
    res.status(500).json({ message: 'Error fetching stakeholder content' });
  }
});

// Update user's stakeholder types
router.put('/me/types', authenticateToken, async (req, res) => {
  try {
    const { stakeholder_types } = req.body;

    // Validate stakeholder types exist
    if (stakeholder_types && stakeholder_types.length > 0) {
      const validTypes = await db.query(
        'SELECT code FROM stakeholder_types WHERE code = ANY($1)',
        [stakeholder_types]
      );

      if (validTypes.rows.length !== stakeholder_types.length) {
        return res.status(400).json({ message: 'Invalid stakeholder type(s) provided' });
      }
    }

    const result = await db.query(
      'UPDATE users SET stakeholder_types = $1 WHERE id = $2 RETURNING stakeholder_types',
      [stakeholder_types || [], req.user.id]
    );

    res.json({ stakeholder_types: result.rows[0].stakeholder_types });
  } catch (error) {
    console.error('Error updating stakeholder types:', error);
    res.status(500).json({ message: 'Error updating stakeholder types' });
  }
});

module.exports = router;

