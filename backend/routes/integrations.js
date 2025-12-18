const express = require('express');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all integrations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT id, name, type, provider, is_active, last_sync_at, created_at FROM integrations WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ integrations: result.rows });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ message: 'Error fetching integrations' });
  }
});

// Create integration
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { name, type, provider, credentials, config } = req.body;

    const result = await db.query(
      `INSERT INTO integrations (organization_id, name, type, provider, credentials, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, type, provider, is_active, created_at`,
      [orgId, name, type, provider, JSON.stringify(credentials || {}), JSON.stringify(config || {})]
    );

    res.status(201).json({ integration: result.rows[0] });
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ message: 'Error creating integration' });
  }
});

// Get webhooks
router.get('/webhooks', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT id, name, url, events, is_active, last_triggered_at, created_at FROM webhooks WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      // Fallback: query all webhooks if organization_id is null
      result = await db.query(
        'SELECT id, name, url, events, is_active, last_triggered_at, created_at FROM webhooks ORDER BY created_at DESC'
      );
    }

    res.json({ webhooks: result.rows || [] });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.json({ webhooks: [] });
  }
});

// Create webhook
router.post('/webhooks', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id;

    const { name, url, events } = req.body;

    if (!name || !url) {
      return res.status(400).json({ message: 'Name and URL are required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'At least one event type must be selected' });
    }

    const secretKey = crypto.randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO webhooks (organization_id, name, url, events, secret_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, url, events, is_active, created_at`,
      [orgId || null, name, url, events, secretKey]
    );

    res.status(201).json({ webhook: result.rows[0], secret_key: secretKey });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ message: 'Error creating webhook', error: error.message });
  }
});

// Get API keys
router.get('/api-keys', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      `SELECT id, name, key_prefix, permissions, expires_at, last_used_at, is_active, created_at
       FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    res.json({ api_keys: result.rows });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ message: 'Error fetching API keys' });
  }
});

// Create API key
router.post('/api-keys', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { name, permissions, expires_at } = req.body;

    // Generate API key
    const apiKey = `eh_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12);

    const result = await db.query(
      `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, key_prefix, permissions, expires_at, created_at`,
      [orgId, name, keyHash, keyPrefix, permissions || [], expires_at]
    );

    res.status(201).json({ api_key: result.rows[0], key: apiKey });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ message: 'Error creating API key' });
  }
});

module.exports = router;

