/**
 * Integration Test Routes
 * Test endpoints for verifying scheduling, billing, and CRM integrations
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const db = require('../../config/database');

// Services
const appointmentSyncService = require('../../services/appointmentSyncService');
const billingSyncService = require('../../services/billingSyncService');
const crmService = require('../../services/crmService');

// ============================================================
// INTEGRATION MANAGEMENT
// ============================================================

/**
 * Create a test integration configuration
 * POST /api/integrations/test/create-integration
 */
router.post('/create-integration', authenticateToken, async (req, res) => {
  try {
    const { type, provider, credentials, name } = req.body;

    if (!type || !provider || !credentials) {
      return res.status(400).json({
        message: 'type, provider, and credentials are required',
        example: {
          type: 'scheduling', // scheduling, billing, crm
          provider: 'google_calendar', // google_calendar, zocdoc, calendly, kareo, salesforce, etc.
          name: 'My Google Calendar',
          credentials: {
            access_token: 'your_access_token',
            // other provider-specific fields
          }
        }
      });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, type, provider, is_active, created_at`,
      [orgId, name || `${provider} Integration`, type, provider, JSON.stringify(credentials)]
    );

    res.status(201).json({
      message: 'Integration created successfully',
      integration: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ message: 'Error creating integration', error: error.message });
  }
});

/**
 * List all integrations
 * GET /api/integrations/test/list
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at, created_at
       FROM integrations 
       WHERE organization_id = $1 OR organization_id IS NULL
       ORDER BY created_at DESC`,
      [orgId]
    );

    res.json({ integrations: result.rows });
  } catch (error) {
    console.error('Error listing integrations:', error);
    res.status(500).json({ message: 'Error listing integrations', error: error.message });
  }
});

// ============================================================
// SCHEDULING INTEGRATION TESTS
// ============================================================

/**
 * Test Google Calendar connection
 * POST /api/integrations/test/scheduling/google-calendar
 */
router.post('/scheduling/google-calendar', authenticateToken, async (req, res) => {
  try {
    const { integration_id, access_token, calendar_id } = req.body;

    // Use provided credentials or fetch from integration
    let credentials;
    if (access_token) {
      credentials = { access_token, calendar_id: calendar_id || 'primary' };
    } else if (integration_id) {
      const intResult = await db.query('SELECT credentials FROM integrations WHERE id = $1', [integration_id]);
      if (intResult.rows.length === 0) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      credentials = typeof intResult.rows[0].credentials === 'string' 
        ? JSON.parse(intResult.rows[0].credentials) 
        : intResult.rows[0].credentials;
    } else {
      return res.status(400).json({ message: 'Either integration_id or access_token is required' });
    }

    // Test by fetching calendar list
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5',
      {
        headers: { 'Authorization': `Bearer ${credentials.access_token}` }
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        message: 'Google Calendar connection failed',
        error: error.error?.message || response.statusText
      });
    }

    const data = await response.json();

    res.json({
      success: true,
      message: 'Google Calendar connection successful',
      calendars: data.items?.map(c => ({ id: c.id, summary: c.summary, primary: c.primary })) || []
    });
  } catch (error) {
    console.error('Google Calendar test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test appointment sync to scheduling system
 * POST /api/integrations/test/scheduling/sync-appointment
 */
router.post('/scheduling/sync-appointment', authenticateToken, async (req, res) => {
  try {
    const { appointment_id, integration_id } = req.body;

    if (!appointment_id || !integration_id) {
      return res.status(400).json({ message: 'appointment_id and integration_id are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await appointmentSyncService.syncAppointment(appointment_id, integration_id, orgId);

    res.json({
      success: true,
      message: 'Appointment synced successfully',
      result
    });
  } catch (error) {
    console.error('Appointment sync test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test get available slots
 * POST /api/integrations/test/scheduling/available-slots
 */
router.post('/scheduling/available-slots', authenticateToken, async (req, res) => {
  try {
    const { integration_id, start_date, end_date } = req.body;

    if (!integration_id) {
      return res.status(400).json({ message: 'integration_id is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const dateRange = {
      start: start_date || new Date().toISOString(),
      end: end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    const result = await appointmentSyncService.getAvailableSlots(integration_id, orgId, dateRange);

    res.json({
      success: true,
      message: 'Available slots retrieved',
      result
    });
  } catch (error) {
    console.error('Get slots test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// BILLING INTEGRATION TESTS
// ============================================================

/**
 * Test billing platform connection
 * POST /api/integrations/test/billing/connection
 */
router.post('/billing/connection', authenticateToken, async (req, res) => {
  try {
    const { integration_id, provider, credentials } = req.body;

    let testCredentials;
    let testProvider;

    if (integration_id) {
      const intResult = await db.query('SELECT * FROM integrations WHERE id = $1', [integration_id]);
      if (intResult.rows.length === 0) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      testCredentials = typeof intResult.rows[0].credentials === 'string' 
        ? JSON.parse(intResult.rows[0].credentials) 
        : intResult.rows[0].credentials;
      testProvider = intResult.rows[0].provider;
    } else if (provider && credentials) {
      testCredentials = credentials;
      testProvider = provider;
    } else {
      return res.status(400).json({ 
        message: 'Either integration_id or (provider + credentials) is required',
        providers: ['kareo', 'advancedmd', 'drchrono', 'athenahealth']
      });
    }

    // Test connection based on provider
    let testResult;
    switch (testProvider.toLowerCase()) {
      case 'drchrono':
        // Test DrChrono connection
        const drResponse = await fetch('https://app.drchrono.com/api/users/current', {
          headers: { 'Authorization': `Bearer ${testCredentials.access_token}` }
        });
        testResult = {
          success: drResponse.ok,
          status: drResponse.status,
          message: drResponse.ok ? 'DrChrono connection successful' : 'DrChrono connection failed'
        };
        break;

      case 'athenahealth':
        // Test AthenaHealth token
        const athenaTokenResponse = await fetch(
          `https://api.athenahealth.com/oauth2/${testCredentials.version || 'v1'}/token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${testCredentials.api_key}:${testCredentials.api_secret}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
          }
        );
        testResult = {
          success: athenaTokenResponse.ok,
          status: athenaTokenResponse.status,
          message: athenaTokenResponse.ok ? 'AthenaHealth connection successful' : 'AthenaHealth connection failed'
        };
        break;

      default:
        testResult = {
          success: true,
          message: `Connection test for ${testProvider} - credentials stored (API test not available)`
        };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Billing connection test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test create charge in billing system
 * POST /api/integrations/test/billing/create-charge
 */
router.post('/billing/create-charge', authenticateToken, async (req, res) => {
  try {
    const { integration_id, charge_data } = req.body;

    if (!integration_id || !charge_data) {
      return res.status(400).json({
        message: 'integration_id and charge_data are required',
        example: {
          integration_id: 1,
          charge_data: {
            patient_id: 'P12345',
            patient_name: 'John Doe',
            amount: 150.00,
            description: 'Office Visit',
            procedure_code: '99213',
            date_of_service: '2025-01-15'
          }
        }
      });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await billingSyncService.createCharge(charge_data, integration_id, orgId);

    res.json({
      success: true,
      message: 'Charge created successfully',
      result
    });
  } catch (error) {
    console.error('Create charge test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test get patient balance
 * POST /api/integrations/test/billing/patient-balance
 */
router.post('/billing/patient-balance', authenticateToken, async (req, res) => {
  try {
    const { integration_id, patient_id } = req.body;

    if (!integration_id || !patient_id) {
      return res.status(400).json({ message: 'integration_id and patient_id are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await billingSyncService.getPatientBalance(patient_id, integration_id, orgId);

    res.json({
      success: true,
      message: 'Patient balance retrieved',
      result
    });
  } catch (error) {
    console.error('Get balance test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// CRM INTEGRATION TESTS
// ============================================================

/**
 * Test CRM connection
 * POST /api/integrations/test/crm/connection
 */
router.post('/crm/connection', authenticateToken, async (req, res) => {
  try {
    const { integration_id, provider, credentials } = req.body;

    let testCredentials;
    let testProvider;

    if (integration_id) {
      const intResult = await db.query('SELECT * FROM integrations WHERE id = $1', [integration_id]);
      if (intResult.rows.length === 0) {
        return res.status(404).json({ message: 'Integration not found' });
      }
      testCredentials = typeof intResult.rows[0].credentials === 'string' 
        ? JSON.parse(intResult.rows[0].credentials) 
        : intResult.rows[0].credentials;
      testProvider = intResult.rows[0].provider;
    } else if (provider && credentials) {
      testCredentials = credentials;
      testProvider = provider;
    } else {
      return res.status(400).json({
        message: 'Either integration_id or (provider + credentials) is required',
        providers: ['salesforce', 'hubspot', 'zendesk', 'freshdesk']
      });
    }

    let testResult;
    switch (testProvider.toLowerCase()) {
      case 'salesforce':
        const sfResponse = await fetch(
          `${testCredentials.instance_url}/services/data/v57.0/limits`,
          { headers: { 'Authorization': `Bearer ${testCredentials.access_token}` } }
        );
        testResult = {
          success: sfResponse.ok,
          status: sfResponse.status,
          message: sfResponse.ok ? 'Salesforce connection successful' : 'Salesforce connection failed'
        };
        break;

      case 'hubspot':
        const hsResponse = await fetch(
          'https://api.hubapi.com/crm/v3/objects/tickets?limit=1',
          { headers: { 'Authorization': `Bearer ${testCredentials.access_token || testCredentials.api_key}` } }
        );
        testResult = {
          success: hsResponse.ok,
          status: hsResponse.status,
          message: hsResponse.ok ? 'HubSpot connection successful' : 'HubSpot connection failed'
        };
        break;

      case 'zendesk':
        let authHeader;
        if (testCredentials.access_token) {
          authHeader = `Bearer ${testCredentials.access_token}`;
        } else {
          authHeader = `Basic ${Buffer.from(`${testCredentials.email}/token:${testCredentials.api_token}`).toString('base64')}`;
        }
        const zdResponse = await fetch(
          `https://${testCredentials.subdomain}.zendesk.com/api/v2/users/me.json`,
          { headers: { 'Authorization': authHeader } }
        );
        testResult = {
          success: zdResponse.ok,
          status: zdResponse.status,
          message: zdResponse.ok ? 'Zendesk connection successful' : 'Zendesk connection failed'
        };
        break;

      case 'freshdesk':
        const fdResponse = await fetch(
          `https://${testCredentials.domain}.freshdesk.com/api/v2/tickets?per_page=1`,
          { headers: { 'Authorization': `Basic ${Buffer.from(`${testCredentials.api_key}:X`).toString('base64')}` } }
        );
        testResult = {
          success: fdResponse.ok,
          status: fdResponse.status,
          message: fdResponse.ok ? 'Freshdesk connection successful' : 'Freshdesk connection failed'
        };
        break;

      default:
        testResult = {
          success: true,
          message: `Connection test for ${testProvider} - credentials stored`
        };
    }

    res.json(testResult);
  } catch (error) {
    console.error('CRM connection test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test create ticket in CRM
 * POST /api/integrations/test/crm/create-ticket
 */
router.post('/crm/create-ticket', authenticateToken, async (req, res) => {
  try {
    const { integration_id, ticket_data } = req.body;

    if (!integration_id || !ticket_data) {
      return res.status(400).json({
        message: 'integration_id and ticket_data are required',
        example: {
          integration_id: 1,
          ticket_data: {
            subject: 'Test Support Request',
            description: 'This is a test ticket from EHealth Med AI',
            priority: 'medium',
            requester_name: 'John Doe',
            requester_email: 'john@example.com'
          }
        }
      });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await crmService.createTicket(ticket_data, integration_id, orgId);

    res.json({
      success: true,
      message: 'Ticket created successfully',
      result
    });
  } catch (error) {
    console.error('Create ticket test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Test get ticket status
 * POST /api/integrations/test/crm/ticket-status
 */
router.post('/crm/ticket-status', authenticateToken, async (req, res) => {
  try {
    const { integration_id, ticket_id } = req.body;

    if (!integration_id || !ticket_id) {
      return res.status(400).json({ message: 'integration_id and ticket_id are required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const result = await crmService.getTicketStatus(ticket_id, integration_id, orgId);

    res.json({
      success: true,
      message: 'Ticket status retrieved',
      result
    });
  } catch (error) {
    console.error('Get ticket status test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// QUICK TEST ENDPOINTS
// ============================================================

/**
 * Quick test all integrations status
 * GET /api/integrations/test/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const integrations = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at
       FROM integrations 
       WHERE (organization_id = $1 OR organization_id IS NULL) AND is_active = true`,
      [orgId]
    );

    res.json({
      message: 'Integration status',
      active_integrations: integrations.rows.length,
      integrations: integrations.rows,
      available_providers: {
        scheduling: ['google_calendar', 'zocdoc', 'calendly', 'ehr'],
        billing: ['kareo', 'advancedmd', 'drchrono', 'athenahealth'],
        crm: ['salesforce', 'hubspot', 'zendesk', 'freshdesk']
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Error checking status', error: error.message });
  }
});

/**
 * Get example credentials format for each provider
 * GET /api/integrations/test/credentials-format
 */
router.get('/credentials-format', authenticateToken, (req, res) => {
  res.json({
    message: 'Credentials format for each provider',
    scheduling: {
      google_calendar: {
        access_token: 'OAuth2 access token',
        refresh_token: 'OAuth2 refresh token (optional)',
        calendar_id: 'Calendar ID (default: primary)'
      },
      zocdoc: {
        api_key: 'Zocdoc API key',
        practice_id: 'Your practice ID'
      },
      calendly: {
        api_key: 'Calendly personal access token',
        user_uri: 'Your Calendly user URI',
        event_type_uri: 'Event type URI for booking'
      }
    },
    billing: {
      kareo: {
        api_key: 'Kareo username/API key',
        api_secret: 'Kareo password',
        practice_id: 'Practice ID',
        customer_key: 'Customer key'
      },
      advancedmd: {
        api_key: 'AdvancedMD API key',
        office_key: 'Office key',
        practice_id: 'Practice ID'
      },
      drchrono: {
        access_token: 'OAuth2 access token',
        client_id: 'Client ID (for refresh)',
        client_secret: 'Client secret (for refresh)'
      },
      athenahealth: {
        api_key: 'API key (client_id)',
        api_secret: 'API secret (client_secret)',
        practice_id: 'Practice ID',
        version: 'API version (v1 or preview1)'
      }
    },
    crm: {
      salesforce: {
        access_token: 'OAuth2 access token',
        instance_url: 'Salesforce instance URL (e.g., https://yourorg.salesforce.com)',
        refresh_token: 'Refresh token (optional)',
        client_id: 'Connected app client ID',
        client_secret: 'Connected app client secret'
      },
      hubspot: {
        api_key: 'HubSpot API key (legacy)',
        access_token: 'Private app access token (preferred)'
      },
      zendesk: {
        subdomain: 'Your Zendesk subdomain',
        email: 'Agent email',
        api_token: 'API token',
        access_token: 'OAuth token (alternative to email+api_token)'
      },
      freshdesk: {
        domain: 'Your Freshdesk domain (without .freshdesk.com)',
        api_key: 'API key'
      }
    }
  });
});

module.exports = router;

