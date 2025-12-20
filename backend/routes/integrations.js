const express = require('express');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const webhookService = require('../services/webhookService');
const appointmentSyncService = require('../services/appointmentSyncService');
const billingSyncService = require('../services/billingSyncService');
const crmService = require('../services/crmService');
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

// Appointment Synchronization
router.post('/appointments/:appointmentId/sync', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { appointmentId } = req.params;
    const { integration_id } = req.body;

    if (!integration_id) {
      return res.status(400).json({ message: 'integration_id is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await appointmentSyncService.syncAppointment(appointmentId, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing appointment:', error);
    res.status(500).json({ message: 'Error syncing appointment', error: error.message });
  }
});

// Billing Synchronization
router.post('/billing/sync', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { billing_data, integration_id } = req.body;

    if (!integration_id || !billing_data) {
      return res.status(400).json({ message: 'integration_id and billing_data are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await billingSyncService.syncBillingData(billing_data, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing billing data:', error);
    res.status(500).json({ message: 'Error syncing billing data', error: error.message });
  }
});

router.post('/billing/charge', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { charge_data, integration_id } = req.body;

    if (!integration_id || !charge_data) {
      return res.status(400).json({ message: 'integration_id and charge_data are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await billingSyncService.createCharge(charge_data, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error creating charge:', error);
    res.status(500).json({ message: 'Error creating charge', error: error.message });
  }
});

router.get('/billing/balance/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { integration_id } = req.query;

    if (!integration_id) {
      return res.status(400).json({ message: 'integration_id is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await billingSyncService.getPatientBalance(patientId, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error getting patient balance:', error);
    res.status(500).json({ message: 'Error getting patient balance', error: error.message });
  }
});

// CRM Ticket Management
router.post('/crm/tickets', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { ticket_data, integration_id } = req.body;

    if (!integration_id || !ticket_data) {
      return res.status(400).json({ message: 'integration_id and ticket_data are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await crmService.createTicket(ticket_data, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error creating CRM ticket:', error);
    res.status(500).json({ message: 'Error creating CRM ticket', error: error.message });
  }
});

router.post('/crm/tickets/from-conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { conversationId } = req.params;
    const { ticket_data, integration_id } = req.body;

    if (!integration_id) {
      return res.status(400).json({ message: 'integration_id is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await crmService.createTicketFromConversation(
      conversationId,
      ticket_data || {},
      integration_id,
      orgId
    );
    res.json(result);
  } catch (error) {
    console.error('Error creating ticket from conversation:', error);
    res.status(500).json({ message: 'Error creating ticket from conversation', error: error.message });
  }
});

router.put('/crm/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { ticketId } = req.params;
    const { updates, integration_id } = req.body;

    if (!integration_id || !updates) {
      return res.status(400).json({ message: 'integration_id and updates are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await crmService.updateTicket(ticketId, updates, integration_id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error updating CRM ticket:', error);
    res.status(500).json({ message: 'Error updating CRM ticket', error: error.message });
  }
});

// Webhook Delivery
router.post('/webhooks/:id/deliver', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { event_type, payload } = req.body;

    if (!event_type || !payload) {
      return res.status(400).json({ message: 'event_type and payload are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await webhookService.deliverWebhook(id, event_type, payload, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error delivering webhook:', error);
    res.status(500).json({ message: 'Error delivering webhook', error: error.message });
  }
});

router.post('/webhooks/retry-failed', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { limit = 10 } = req.body;

    const result = await webhookService.retryFailedWebhooks(limit);
    res.json({ results: result });
  } catch (error) {
    console.error('Error retrying failed webhooks:', error);
    res.status(500).json({ message: 'Error retrying failed webhooks', error: error.message });
  }
});

// GoHighLevel Routes
const ghlService = require('../services/ghlService');

router.get('/ghl/auth-url', authenticateToken, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state in session/db if needed for security validation
  const url = ghlService.getAuthUrl(state);
  res.json({ url });
});

router.post('/ghl/callback', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const tokenData = await ghlService.exchangeCodeForToken(code);

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Store in grm_integrations
    await db.query(
      `INSERT INTO grm_integrations (organization_id, type, credentials)
       VALUES ($1, 'ghl', $2)
       ON CONFLICT (organization_id, type) 
       DO UPDATE SET credentials = $2, updated_at = CURRENT_TIMESTAMP`,
      [orgId, JSON.stringify({ ...tokenData, created_at_ts: Date.now() })]
    );

    res.json({ success: true, message: 'GoHighLevel connected successfully' });
  } catch (error) {
    console.error('GHL Callback Error:', error);
    res.status(500).json({ message: 'Failed to connect GoHighLevel' });
  }
});

// Mount test routes
const testRoutes = require('./integrations/test');
router.use('/test', testRoutes);

module.exports = router;

