const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

module.exports = router;

