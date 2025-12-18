const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get current user's organization
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, bc.logo_url, bc.primary_color, bc.secondary_color, bc.company_name
       FROM organizations o
       LEFT JOIN branding_configs bc ON o.id = bc.organization_id
       WHERE o.id = (SELECT organization_id FROM users WHERE id = $1)`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.json({ organization: result.rows[0] });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ message: 'Error fetching organization' });
  }
});

// Update organization (admin only)
router.put('/me', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month } = req.body;

    const result = await db.query(
      `UPDATE organizations 
       SET name = COALESCE($1, name),
           subdomain = COALESCE($2, subdomain),
           domain = COALESCE($3, domain),
           subscription_tier = COALESCE($4, subscription_tier),
           max_agents = COALESCE($5, max_agents),
           max_users = COALESCE($6, max_users),
           max_calls_per_month = COALESCE($7, max_calls_per_month),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT organization_id FROM users WHERE id = $8)
       RETURNING *`,
      [name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month, req.user.id]
    );

    res.json({ organization: result.rows[0] });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ message: 'Error updating organization' });
  }
});

module.exports = router;

