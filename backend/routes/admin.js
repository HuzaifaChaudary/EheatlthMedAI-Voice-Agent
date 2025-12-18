const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Create user (admin only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate role
    const validRoles = ['admin', 'patient', 'doctor', 'client', 'user'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be one of: admin, patient, doctor, client, user' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email, passwordHash, firstName, lastName, role, true]
    );

    const newUser = result.rows[0];

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'CREATE_USER',
        'users',
        newUser.id,
        JSON.stringify({ email, role, created_by: req.user.email })
      ]
    );

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) FROM users';
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(email ILIKE $${params.length + 1} OR first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active, first_name, last_name } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET role = COALESCE($1, role),
           is_active = COALESCE($2, is_active),
           first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, email, first_name, last_name, role, is_active, updated_at`,
      [role || null, is_active !== undefined ? is_active : null, first_name || null, last_name || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'UPDATE_USER',
        'users',
        id,
        JSON.stringify({ changes: req.body })
      ]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'DELETE_USER',
        'users',
        id,
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Get audit logs (admin only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT al.*, u.email as user_email, u.first_name, u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});

// Get dashboard stats (admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersCount, agentsCount, conversationsCount, appointmentsCount] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM ai_agents'),
      db.query('SELECT COUNT(*) as count FROM conversations'),
      db.query('SELECT COUNT(*) as count FROM appointments')
    ]);

    const recentUsers = await db.query(
      'SELECT id, email, first_name, last_name, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      stats: {
        users: parseInt(usersCount.rows[0].count),
        agents: parseInt(agentsCount.rows[0].count),
        conversations: parseInt(conversationsCount.rows[0].count),
        appointments: parseInt(appointmentsCount.rows[0].count)
      },
      recentUsers: recentUsers.rows
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

module.exports = router;

