const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get portals
router.get('/portals', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM portals WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT * FROM portals WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ portals: result.rows || [] });
  } catch (error) {
    console.error('Error fetching portals:', error);
    res.json({ portals: [] });
  }
});

// Create portal
router.post('/portals', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, type, url, config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    if (url) {
      // Validate URL if provided
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: 'Invalid URL format' });
      }
    }

    const result = await db.query(
      `INSERT INTO portals (organization_id, name, type, url, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId || null, name, type, url || null, JSON.stringify(config || {})]
    );

    res.status(201).json({ portal: result.rows[0] });
  } catch (error) {
    console.error('Error creating portal:', error);
    res.status(500).json({ message: 'Error creating portal', error: error.message });
  }
});

// Get SDKs
router.get('/sdks', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM sdks WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT * FROM sdks WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ sdks: result.rows || [] });
  } catch (error) {
    console.error('Error fetching SDKs:', error);
    res.json({ sdks: [] });
  }
});

// Create SDK
router.post('/sdks', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, language, version, download_url, documentation_url, api_key_prefix } = req.body;

    if (!name || !version) {
      return res.status(400).json({ message: 'Name and version are required' });
    }

    // Validate URLs if provided
    if (download_url) {
      try {
        new URL(download_url);
      } catch {
        return res.status(400).json({ message: 'Invalid download_url format' });
      }
    }

    if (documentation_url) {
      try {
        new URL(documentation_url);
      } catch {
        return res.status(400).json({ message: 'Invalid documentation_url format' });
      }
    }

    const result = await db.query(
      `INSERT INTO sdks (organization_id, name, language, version, download_url, documentation_url, api_key_prefix)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId || null, name, language || 'javascript', version, download_url || null, documentation_url || null, api_key_prefix || null]
    );

    res.status(201).json({ sdk: result.rows[0] });
  } catch (error) {
    console.error('Error creating SDK:', error);
    res.status(500).json({ message: 'Error creating SDK', error: error.message });
  }
});

// Get voice channels
router.get('/channels', authenticateToken, async (req, res) => {
  try {
    const { agent_id } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let query;
    const params = [];

    if (orgId) {
      query = 'SELECT * FROM voice_channels WHERE organization_id = $1';
      params.push(orgId);
    } else {
      query = 'SELECT * FROM voice_channels WHERE organization_id IS NULL';
    }

    if (agent_id) {
      params.push(agent_id);
      query += ` AND agent_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ channels: result.rows || [] });
  } catch (error) {
    console.error('Error fetching voice channels:', error);
    res.json({ channels: [] });
  }
});

// Create voice channel
router.post('/channels', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { agent_id, channel_type, channel_config } = req.body;

    if (!agent_id || !channel_type) {
      return res.status(400).json({ message: 'agent_id and channel_type are required' });
    }

    // Verify agent exists and belongs to organization
    let agentResult;
    if (orgId) {
      agentResult = await db.query(
        'SELECT id FROM ai_agents WHERE id = $1 AND organization_id = $2',
        [agent_id, orgId]
      );
    } else {
      agentResult = await db.query(
        'SELECT id FROM ai_agents WHERE id = $1 AND organization_id IS NULL',
        [agent_id]
      );
    }

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const result = await db.query(
      `INSERT INTO voice_channels (organization_id, agent_id, channel_type, channel_config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orgId || null, agent_id, channel_type, JSON.stringify(channel_config || {})]
    );

    res.status(201).json({ channel: result.rows[0] });
  } catch (error) {
    console.error('Error creating voice channel:', error);
    res.status(500).json({ message: 'Error creating voice channel', error: error.message });
  }
});

// Delete voice channel
router.delete('/channels/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    // Verify channel belongs to organization
    let channelResult;
    if (orgId) {
      channelResult = await db.query(
        'SELECT * FROM voice_channels WHERE id = $1 AND organization_id = $2',
        [id, orgId]
      );
    } else {
      channelResult = await db.query(
        'SELECT * FROM voice_channels WHERE id = $1 AND organization_id IS NULL',
        [id]
      );
    }

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ message: 'Voice channel not found' });
    }

    // Delete the channel
    await db.query('DELETE FROM voice_channels WHERE id = $1', [id]);

    res.json({ message: 'Voice channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting voice channel:', error);
    res.status(500).json({ message: 'Error deleting voice channel', error: error.message });
  }
});

module.exports = router;

