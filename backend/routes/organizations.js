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
      // Return a default organization structure for users without one
      return res.json({ 
        organization: null,
        message: 'No organization linked. Create one to get started.'
      });
    }

    res.json({ organization: result.rows[0] });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ message: 'Error fetching organization' });
  }
});

// Create organization (admin only - for users without an organization)
router.post('/me', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Check if user already has an organization
    const userCheck = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userCheck.rows[0]?.organization_id) {
      return res.status(400).json({ message: 'User already has an organization' });
    }

    const { 
      name = 'My Organization', 
      subdomain, 
      domain,
      subscription_tier = 'free',
      max_agents = 5,
      max_users = 10,
      max_calls_per_month = 1000
    } = req.body;

    // Create the organization
    const orgResult = await db.query(
      `INSERT INTO organizations (name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month]
    );

    const newOrg = orgResult.rows[0];

    // Link user to the new organization
    await db.query(
      'UPDATE users SET organization_id = $1 WHERE id = $2',
      [newOrg.id, req.user.id]
    );

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'CREATE_ORGANIZATION', 'organizations', newOrg.id, JSON.stringify({ name, subdomain })]
    );

    res.status(201).json({ 
      message: 'Organization created successfully',
      organization: newOrg 
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ message: 'Error creating organization', error: error.message });
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

