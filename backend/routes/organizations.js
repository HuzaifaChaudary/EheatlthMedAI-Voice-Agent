const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Create new organization (admin only) - for creating sub-accounts
// IMPORTANT: This route must come BEFORE /me routes to avoid conflicts
router.post('/', authenticateToken, async (req, res) => {
  console.log('🔵 POST /organizations endpoint hit');
  console.log('  User:', req.user?.id, 'Role:', req.user?.role);
  console.log('  Body:', req.body);
  try {
    if (req.user.role !== 'admin') {
      console.log('❌ Not admin, returning 403');
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      name,
      subdomain, 
      domain,
      subscription_tier = 'professional',
      max_agents = 10,
      max_users = 20,
      max_calls_per_month = 5000,
      user_email // Optional: email of user to assign to this organization
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    // Create the organization
    const orgResult = await db.query(
      `INSERT INTO organizations (name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [name, subdomain, domain, subscription_tier, max_agents, max_users, max_calls_per_month]
    );

    const newOrg = orgResult.rows[0];

    // If user_email provided, link that user to the organization
    if (user_email) {
      await db.query(
        'UPDATE users SET organization_id = $1 WHERE email = $2',
        [newOrg.id, user_email]
      );
    }

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'CREATE_ORGANIZATION', 'organizations', newOrg.id, JSON.stringify({ name, subdomain, user_email })]
    );

    res.status(201).json({ 
      message: 'Organization created successfully',
      organization: newOrg 
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Organization with this subdomain or domain already exists' });
    }
    res.status(500).json({ message: 'Error creating organization', error: error.message });
  }
});

// Get all organizations (admin only) - for master account view
// IMPORTANT: This route must come BEFORE /me routes to avoid conflicts
router.get('/all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await db.query(
      `SELECT o.*, 
              COUNT(DISTINCT u.id) as user_count,
              COUNT(DISTINCT a.id) as agent_count,
              COUNT(DISTINCT pn.id) as phone_number_count
       FROM organizations o
       LEFT JOIN users u ON o.id = u.organization_id
       LEFT JOIN ai_agents a ON o.id = a.organization_id
       LEFT JOIN phone_numbers pn ON o.id = pn.organization_id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );

    res.json({ organizations: result.rows || [] });
  } catch (error) {
    console.error('Error fetching all organizations:', error);
    res.status(500).json({ message: 'Error fetching organizations', error: error.message });
  }
});

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

// Get organization details with all resources (admin only)
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    // Get organization
    const orgResult = await db.query('SELECT * FROM organizations WHERE id = $1', [id]);
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const organization = orgResult.rows[0];

    // Get users
    const usersResult = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE organization_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get agents
    const agentsResult = await db.query(
      'SELECT id, name, type, description, is_active, created_at FROM ai_agents WHERE organization_id = $1 ORDER BY type, name',
      [id]
    );

    // Get phone numbers
    const phoneNumbersResult = await db.query(
      'SELECT id, phone_number, provider, is_active, created_at FROM phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get call statistics
    const callsResult = await db.query(
      `SELECT COUNT(*) as total_calls, 
              COUNT(DISTINCT caller_phone) as unique_callers,
              SUM(duration_seconds) as total_duration
       FROM call_logs cl
       JOIN phone_numbers pn ON cl.phone_number_id = pn.id
       WHERE pn.organization_id = $1`,
      [id]
    );

    res.json({
      organization,
      resources: {
        users: usersResult.rows || [],
        agents: agentsResult.rows || [],
        phone_numbers: phoneNumbersResult.rows || [],
        stats: {
          total_calls: parseInt(callsResult.rows[0]?.total_calls || 0),
          unique_callers: parseInt(callsResult.rows[0]?.unique_callers || 0),
          total_duration: parseInt(callsResult.rows[0]?.total_duration || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching organization details:', error);
    res.status(500).json({ message: 'Error fetching organization details', error: error.message });
  }
});

module.exports = router;

