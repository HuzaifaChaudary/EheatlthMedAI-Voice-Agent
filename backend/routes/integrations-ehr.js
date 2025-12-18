const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const hl7Service = require('../services/hl7Service');
const fhirService = require('../services/fhirService');
const ehrSyncService = require('../services/ehrSyncService');
const router = express.Router();

// HL7 Connectors
router.get('/hl7', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM hl7_connectors WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT * FROM hl7_connectors WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ connectors: result.rows || [] });
  } catch (error) {
    console.error('Error fetching HL7 connectors:', error);
    res.json({ connectors: [] });
  }
});

router.post('/hl7', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, hl7_version, message_types, endpoint_url, authentication_type, credentials } = req.body;

    if (!name || !endpoint_url) {
      return res.status(400).json({ message: 'Name and endpoint_url are required' });
    }

    // Validate URL
    try {
      new URL(endpoint_url);
    } catch {
      return res.status(400).json({ message: 'Invalid endpoint_url format' });
    }

    const result = await db.query(
      `INSERT INTO hl7_connectors (organization_id, name, hl7_version, message_types, endpoint_url, authentication_type, credentials)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, hl7_version, message_types, endpoint_url, authentication_type, is_active, created_at`,
      [orgId || null, name, hl7_version || '2.8', message_types || [], endpoint_url, authentication_type || 'basic', JSON.stringify(credentials || {})]
    );

    res.status(201).json({ connector: result.rows[0] });
  } catch (error) {
    console.error('Error creating HL7 connector:', error);
    res.status(500).json({ message: 'Error creating HL7 connector', error: error.message });
  }
});

// FHIR Connectors
router.get('/fhir', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM fhir_connectors WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT * FROM fhir_connectors WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ connectors: result.rows || [] });
  } catch (error) {
    console.error('Error fetching FHIR connectors:', error);
    res.json({ connectors: [] });
  }
});

router.post('/fhir', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, fhir_version, base_url, resource_types, authentication_type, credentials } = req.body;

    if (!name || !base_url) {
      return res.status(400).json({ message: 'Name and base_url are required' });
    }

    // Validate URL
    try {
      new URL(base_url);
    } catch {
      return res.status(400).json({ message: 'Invalid base_url format' });
    }

    const result = await db.query(
      `INSERT INTO fhir_connectors (organization_id, name, fhir_version, base_url, resource_types, authentication_type, credentials)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, fhir_version, base_url, resource_types, authentication_type, is_active, created_at`,
      [orgId || null, name, fhir_version || 'R4', base_url, resource_types || [], authentication_type || 'oauth2', JSON.stringify(credentials || {})]
    );

    res.status(201).json({ connector: result.rows[0] });
  } catch (error) {
    console.error('Error creating FHIR connector:', error);
    res.status(500).json({ message: 'Error creating FHIR connector', error: error.message });
  }
});

// EHR Systems (alias for /systems)
router.get('/systems', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      `SELECT e.*, 
              CASE 
                WHEN e.connector_type = 'hl7' THEN h.name
                WHEN e.connector_type = 'fhir' THEN f.name
              END as connector_name
       FROM ehr_systems e
       LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
       LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
       WHERE e.organization_id = $1
       ORDER BY e.created_at DESC`,
      [orgId]
    );

    // Map to expected format
    const systems = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      vendor: row.vendor,
      integration_type: row.connection_type || row.ehr_type,
      connection_status: row.is_active ? 'connected' : (row.last_sync_at ? 'disconnected' : 'pending'),
      last_sync: row.last_sync_at
    }));

    res.json({ systems });
  } catch (error) {
    console.error('Error fetching EHR systems:', error);
    res.status(500).json({ message: 'Error fetching EHR systems' });
  }
});

router.post('/systems', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { name, vendor, integration_type, api_endpoint, credentials } = req.body;

    // Store api_endpoint and connection_status in a metadata JSONB field
    // First check if we need to add columns or use existing structure
    const result = await db.query(
      `INSERT INTO ehr_systems (organization_id, name, vendor, ehr_type, connection_type, connector_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, vendor, ehr_type, connection_type, is_active, created_at`,
      [orgId, name, vendor, integration_type || vendor, integration_type, integration_type]
    );

    const system = result.rows[0];
    
    // Return with expected fields
    const response = {
      id: system.id,
      name: system.name,
      vendor: system.vendor,
      integration_type: system.connection_type,
      connection_status: system.is_active ? 'connected' : 'pending',
      last_sync: null
    };

    res.status(201).json({ system: response });
  } catch (error) {
    console.error('Error creating EHR system:', error);
    res.status(500).json({ message: 'Error creating EHR system' });
  }
});

// EHR Systems
router.get('/ehr', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      `SELECT e.*, 
              CASE 
                WHEN e.connector_type = 'hl7' THEN h.name
                WHEN e.connector_type = 'fhir' THEN f.name
              END as connector_name
       FROM ehr_systems e
       LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
       LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
       WHERE e.organization_id = $1
       ORDER BY e.created_at DESC`,
      [orgId]
    );

    res.json({ ehr_systems: result.rows });
  } catch (error) {
    console.error('Error fetching EHR systems:', error);
    res.status(500).json({ message: 'Error fetching EHR systems' });
  }
});

router.post('/ehr', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { name, vendor, ehr_type, connection_type, connector_id, connector_type, sync_enabled, sync_frequency } = req.body;

    const result = await db.query(
      `INSERT INTO ehr_systems (organization_id, name, vendor, ehr_type, connection_type, connector_id, connector_type, sync_enabled, sync_frequency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orgId, name, vendor, ehr_type, connection_type, connector_id, connector_type, sync_enabled, sync_frequency]
    );

    res.status(201).json({ ehr_system: result.rows[0] });
  } catch (error) {
    console.error('Error creating EHR system:', error);
    res.status(500).json({ message: 'Error creating EHR system' });
  }
});

// HL7 Message Operations
router.post('/hl7/:id/send', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { message_data, message_string } = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const connectorResult = await db.query(
      'SELECT * FROM hl7_connectors WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [id, orgId]
    );

    if (connectorResult.rows.length === 0) {
      return res.status(404).json({ message: 'HL7 connector not found' });
    }

    const connector = connectorResult.rows[0];

    let hl7Message;
    if (message_string) {
      hl7Message = message_string;
    } else if (message_data) {
      hl7Message = hl7Service.generateMessage(message_data);
    } else {
      return res.status(400).json({ message: 'message_data or message_string is required' });
    }

    const result = await hl7Service.sendMessage(hl7Message, connector);
    res.json(result);
  } catch (error) {
    console.error('Error sending HL7 message:', error);
    res.status(500).json({ message: 'Error sending HL7 message', error: error.message });
  }
});

router.post('/hl7/parse', authenticateToken, async (req, res) => {
  try {
    const { message_string } = req.body;

    if (!message_string) {
      return res.status(400).json({ message: 'message_string is required' });
    }

    const parsed = hl7Service.parseMessage(message_string);
    res.json({ parsed });
  } catch (error) {
    console.error('Error parsing HL7 message:', error);
    res.status(500).json({ message: 'Error parsing HL7 message', error: error.message });
  }
});

router.post('/hl7/generate-adt', authenticateToken, async (req, res) => {
  try {
    const appointmentData = req.body;
    const hl7Message = hl7Service.generateADTMessage(appointmentData);
    res.json({ message: hl7Message });
  } catch (error) {
    console.error('Error generating HL7 ADT message:', error);
    res.status(500).json({ message: 'Error generating HL7 message', error: error.message });
  }
});

// FHIR Resource Operations
router.post('/fhir/:id/resources/:resourceType', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id, resourceType } = req.params;
    const resourceData = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const connectorResult = await db.query(
      'SELECT * FROM fhir_connectors WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [id, orgId]
    );

    if (connectorResult.rows.length === 0) {
      return res.status(404).json({ message: 'FHIR connector not found' });
    }

    const connector = connectorResult.rows[0];
    const result = await fhirService.createResource(connector, resourceType, resourceData);
    res.json(result);
  } catch (error) {
    console.error('Error creating FHIR resource:', error);
    res.status(500).json({ message: 'Error creating FHIR resource', error: error.message });
  }
});

router.get('/fhir/:id/resources/:resourceType/:resourceId', authenticateToken, async (req, res) => {
  try {
    const { id, resourceType, resourceId } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const connectorResult = await db.query(
      'SELECT * FROM fhir_connectors WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [id, orgId]
    );

    if (connectorResult.rows.length === 0) {
      return res.status(404).json({ message: 'FHIR connector not found' });
    }

    const connector = connectorResult.rows[0];
    const result = await fhirService.getResource(connector, resourceType, resourceId);
    res.json(result);
  } catch (error) {
    console.error('Error getting FHIR resource:', error);
    res.status(500).json({ message: 'Error getting FHIR resource', error: error.message });
  }
});

router.get('/fhir/:id/resources/:resourceType', authenticateToken, async (req, res) => {
  try {
    const { id, resourceType } = req.params;
    const searchParams = req.query;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const connectorResult = await db.query(
      'SELECT * FROM fhir_connectors WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [id, orgId]
    );

    if (connectorResult.rows.length === 0) {
      return res.status(404).json({ message: 'FHIR connector not found' });
    }

    const connector = connectorResult.rows[0];
    const result = await fhirService.searchResources(connector, resourceType, searchParams);
    res.json(result);
  } catch (error) {
    console.error('Error searching FHIR resources:', error);
    res.status(500).json({ message: 'Error searching FHIR resources', error: error.message });
  }
});

// EHR Synchronization
router.post('/ehr/:id/sync/patient', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const patientData = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await ehrSyncService.syncPatientToEHR(patientData, id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing patient to EHR:', error);
    res.status(500).json({ message: 'Error syncing patient to EHR', error: error.message });
  }
});

router.post('/ehr/:id/sync/appointment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const appointmentData = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await ehrSyncService.syncAppointmentToEHR(appointmentData, id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing appointment to EHR:', error);
    res.status(500).json({ message: 'Error syncing appointment to EHR', error: error.message });
  }
});

router.get('/ehr/:id/pull/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const { id, patientId } = req.params;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const result = await ehrSyncService.pullPatientFromEHR(patientId, id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error pulling patient from EHR:', error);
    res.status(500).json({ message: 'Error pulling patient from EHR', error: error.message });
  }
});

router.get('/ehr/:id/pull/appointments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const dateRange = (start_date || end_date) ? {
      start: start_date,
      end: end_date
    } : null;

    const result = await ehrSyncService.pullAppointmentsFromEHR(id, orgId, dateRange);
    res.json(result);
  } catch (error) {
    console.error('Error pulling appointments from EHR:', error);
    res.status(500).json({ message: 'Error pulling appointments from EHR', error: error.message });
  }
});

// Webhook Events
router.get('/webhooks/events', authenticateToken, async (req, res) => {
  try {
    const { webhook_id, status, limit = 50 } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let query;
    const params = [];

    if (orgId) {
      query = 'SELECT * FROM webhook_events WHERE organization_id = $1';
      params.push(orgId);
    } else {
      query = 'SELECT * FROM webhook_events WHERE organization_id IS NULL';
    }

    if (webhook_id) {
      params.push(webhook_id);
      query += ` AND webhook_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json({ events: result.rows || [] });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.json({ events: [] });
  }
});

module.exports = router;

