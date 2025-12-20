const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const encryptionService = require('../services/encryptionService');
const router = express.Router();

// Get encryption keys
router.get('/encryption-keys', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT id, key_name, key_type, algorithm, rotation_date, is_active, created_at, expires_at FROM encryption_keys WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT id, key_name, key_type, algorithm, rotation_date, is_active, created_at, expires_at FROM encryption_keys WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ keys: result.rows || [] });
  } catch (error) {
    console.error('Error fetching encryption keys:', error);
    res.json({ keys: [] });
  }
});

// Create encryption key
router.post('/encryption-keys', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { key_name, key_type, algorithm, expires_at } = req.body;

    if (!key_name) {
      return res.status(400).json({ message: 'Key name is required' });
    }

    // Generate and encrypt a real key
    const key = encryptionService.generateKey();
    const masterKey = encryptionService.generateKeyFromEnv();
    const encrypted = encryptionService.encrypt(key.toString('hex'), masterKey);
    const keyEncrypted = JSON.stringify(encrypted);

    const result = await db.query(
      `INSERT INTO encryption_keys (organization_id, key_name, key_type, algorithm, key_encrypted, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, key_name, key_type, algorithm, created_at, expires_at, is_active`,
      [orgId || null, key_name, key_type || 'data_at_rest', algorithm || 'AES-256', keyEncrypted, expires_at || null]
    );

    // Log key creation
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'CREATE_ENCRYPTION_KEY', 'encryption_keys', result.rows[0].id, JSON.stringify({ key_name, key_type })]
    );

    res.status(201).json({ key: result.rows[0] });
  } catch (error) {
    console.error('Error creating encryption key:', error);
    res.status(500).json({ message: 'Error creating encryption key', error: error.message });
  }
});

// Delete encryption key
router.delete('/encryption-keys/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { id } = req.params;

    // Check if key exists and belongs to organization
    let checkQuery, checkParams;
    if (orgId) {
      checkQuery = 'SELECT id, key_name FROM encryption_keys WHERE id = $1 AND organization_id = $2';
      checkParams = [id, orgId];
    } else {
      checkQuery = 'SELECT id, key_name FROM encryption_keys WHERE id = $1 AND organization_id IS NULL';
      checkParams = [id];
    }

    const checkResult = await db.query(checkQuery, checkParams);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Encryption key not found' });
    }

    const keyName = checkResult.rows[0].key_name;

    // Delete the key
    await db.query('DELETE FROM encryption_keys WHERE id = $1', [id]);

    // Log deletion
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'DELETE_ENCRYPTION_KEY', 'encryption_keys', id, JSON.stringify({ key_name: keyName })]
    );

    res.json({ message: 'Encryption key deleted successfully' });
  } catch (error) {
    console.error('Error deleting encryption key:', error);
    res.status(500).json({ message: 'Error deleting encryption key', error: error.message });
  }
});

// Deactivate encryption key (soft delete - preferred for HIPAA compliance)
router.patch('/encryption-keys/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { id } = req.params;

    let updateQuery, updateParams;
    if (orgId) {
      updateQuery = 'UPDATE encryption_keys SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2 RETURNING id, key_name, is_active';
      updateParams = [id, orgId];
    } else {
      updateQuery = 'UPDATE encryption_keys SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id IS NULL RETURNING id, key_name, is_active';
      updateParams = [id];
    }

    const result = await db.query(updateQuery, updateParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Encryption key not found' });
    }

    // Log deactivation
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'DEACTIVATE_ENCRYPTION_KEY', 'encryption_keys', id, JSON.stringify({ key_name: result.rows[0].key_name })]
    );

    res.json({ message: 'Encryption key deactivated', key: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating encryption key:', error);
    res.status(500).json({ message: 'Error deactivating encryption key', error: error.message });
  }
});

// Rotate encryption key
router.post('/encryption-keys/rotate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { key_id, rotation_reason } = req.body;

    // Get old key
    const oldKeyResult = await db.query(
      'SELECT * FROM encryption_keys WHERE id = $1 AND organization_id = $2',
      [key_id, orgId]
    );

    if (oldKeyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Encryption key not found' });
    }

    const oldKey = oldKeyResult.rows[0];

    // Generate and encrypt new key
    const newKey = encryptionService.generateKey();
    const masterKey = encryptionService.generateKeyFromEnv();
    const encrypted = encryptionService.encrypt(newKey.toString('hex'), masterKey);
    const newKeyEncrypted = JSON.stringify(encrypted);

    // Deactivate old key
    await db.query(
      'UPDATE encryption_keys SET is_active = false, rotation_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [key_id]
    );

    // Create new active key
    const newKeyResult = await db.query(
      `INSERT INTO encryption_keys (organization_id, key_name, key_type, algorithm, key_encrypted, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
       RETURNING id`,
      [orgId, `${oldKey.key_name}_rotated_${Date.now()}`, oldKey.key_type, oldKey.algorithm, newKeyEncrypted]
    );

    // Log rotation
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'ROTATE_ENCRYPTION_KEY',
        'encryption_keys',
        newKeyResult.rows[0].id,
        JSON.stringify({ old_key_id: key_id, new_key_id: newKeyResult.rows[0].id, reason: rotation_reason || 'Manual rotation' })
      ]
    );

    res.json({ message: 'Key rotated successfully' });
  } catch (error) {
    console.error('Error rotating key:', error);
    res.status(500).json({ message: 'Error rotating encryption key' });
  }
});

// Get access policies
router.get('/access-policies', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM access_policies WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      result = await db.query(
        'SELECT * FROM access_policies WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ policies: result.rows || [] });
  } catch (error) {
    console.error('Error fetching access policies:', error);
    res.json({ policies: [] });
  }
});

// Create access policy
router.post('/access-policies', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, resource_type, resource_id, role, permissions, conditions } = req.body;

    if (!name || !resource_type || !role) {
      return res.status(400).json({ message: 'Name, resource_type, and role are required' });
    }

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: 'At least one permission is required' });
    }

    const result = await db.query(
      `INSERT INTO access_policies (organization_id, name, resource_type, resource_id, role, permissions, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId || null, name, resource_type, resource_id || null, role, permissions, JSON.stringify(conditions || {})]
    );

    // Log policy creation
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'CREATE_ACCESS_POLICY', 'access_policies', result.rows[0].id, JSON.stringify({ name, role, permissions })]
    );

    res.status(201).json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Error creating access policy:', error);
    res.status(500).json({ message: 'Error creating access policy', error: error.message });
  }
});

// Update access policy
router.put('/access-policies/:id', authenticateToken, async (req, res) => {
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

    const { name, permissions, conditions, is_active } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(permissions);
    }
    if (conditions !== undefined) {
      updates.push(`conditions = $${paramCount++}`);
      values.push(JSON.stringify(conditions));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    let query = `UPDATE access_policies SET ${updates.join(', ')} WHERE id = $${paramCount}`;
    
    if (orgId) {
      values.push(orgId);
      query += ` AND (organization_id = $${paramCount + 1} OR organization_id IS NULL)`;
    } else {
      query += ` AND organization_id IS NULL`;
    }
    
    query += ' RETURNING *';

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Access policy not found' });
    }

    // Log policy update
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'UPDATE_ACCESS_POLICY', 'access_policies', id, JSON.stringify({ name, permissions })]
    );

    res.json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Error updating access policy:', error);
    res.status(500).json({ message: 'Error updating access policy', error: error.message });
  }
});

// Delete access policy
router.delete('/access-policies/:id', authenticateToken, async (req, res) => {
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

    // Get policy info before deleting
    let checkQuery, checkParams;
    if (orgId) {
      checkQuery = 'SELECT id, name, role FROM access_policies WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)';
      checkParams = [id, orgId];
    } else {
      checkQuery = 'SELECT id, name, role FROM access_policies WHERE id = $1 AND organization_id IS NULL';
      checkParams = [id];
    }

    const checkResult = await db.query(checkQuery, checkParams);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Access policy not found' });
    }

    const policy = checkResult.rows[0];

    // Delete the policy
    await db.query('DELETE FROM access_policies WHERE id = $1', [id]);

    // Log deletion
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'DELETE_ACCESS_POLICY', 'access_policies', id, JSON.stringify({ name: policy.name, role: policy.role })]
    );

    res.json({ message: 'Access policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting access policy:', error);
    res.status(500).json({ message: 'Error deleting access policy', error: error.message });
  }
});

// ==========================================
// API Key Management Routes
// ==========================================

const apiKeyService = require('../services/apiKeyService');

// Create a new API key
router.post('/api-keys', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { name, permissions, expires_at } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Key name is required' });
    }

    const apiKey = await apiKeyService.createApiKey(
      orgId,
      name,
      permissions || ['read'],
      expires_at || null,
      req.user.id
    );

    res.status(201).json({
      message: 'API key created successfully',
      api_key: apiKey,
      warning: 'Save this key securely - it will not be shown again!'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ message: 'Error creating API key', error: error.message });
  }
});

// List API keys (masked)
router.get('/api-keys', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const keys = await apiKeyService.getApiKeys(orgId);
    res.json({ api_keys: keys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ message: 'Error fetching API keys', error: error.message });
  }
});

// Revoke an API key
router.delete('/api-keys/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const success = await apiKeyService.revokeApiKey(
      parseInt(req.params.id),
      orgId,
      req.user.id
    );

    if (!success) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ message: 'Error revoking API key', error: error.message });
  }
});

// Rotate an API key
router.post('/api-keys/:id/rotate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const newKey = await apiKeyService.rotateApiKey(
      parseInt(req.params.id),
      orgId,
      req.user.id
    );

    res.json({
      message: 'API key rotated successfully',
      new_api_key: newKey,
      warning: 'Save this key securely - it will not be shown again!'
    });
  } catch (error) {
    console.error('Error rotating API key:', error);
    res.status(500).json({ message: 'Error rotating API key', error: error.message });
  }
});

// ==========================================
// Security Incidents Routes
// ==========================================

const securityIncidentService = require('../services/securityIncidentService');

// Get security incidents
router.get('/incidents', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { type, severity, status, start_date, end_date, limit, offset } = req.query;

    const incidents = await securityIncidentService.getIncidents({
      organizationId: req.user.role === 'admin' ? orgId : orgId, // Admin can see org incidents
      incidentType: type,
      severity,
      status,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({ incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ message: 'Error fetching incidents', error: error.message });
  }
});

// Get incident details
router.get('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const incident = await securityIncidentService.getIncident(
      parseInt(req.params.id),
      orgId
    );

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json({ incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ message: 'Error fetching incident', error: error.message });
  }
});

// Update incident status
router.put('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const incident = await securityIncidentService.updateIncidentStatus(
      parseInt(req.params.id),
      status,
      req.user.id,
      notes
    );

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json({ message: 'Incident updated', incident });
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ message: 'Error updating incident', error: error.message });
  }
});

// Add response to incident
router.post('/incidents/:id/respond', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { action_type, notes, metadata } = req.body;

    if (!action_type) {
      return res.status(400).json({ message: 'Action type is required' });
    }

    const response = await securityIncidentService.addIncidentResponse(
      parseInt(req.params.id),
      action_type,
      req.user.id,
      notes,
      metadata || {}
    );

    res.status(201).json({ message: 'Response added', response });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ message: 'Error adding response', error: error.message });
  }
});

// Get incident statistics
router.get('/incident-stats', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const days = parseInt(req.query.days) || 30;
    const stats = await securityIncidentService.getIncidentStats(orgId, days);

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching incident stats:', error);
    res.status(500).json({ message: 'Error fetching incident stats', error: error.message });
  }
});

// ==========================================
// Intrusion Detection Routes
// ==========================================

const intrusionDetectionService = require('../services/intrusionDetectionService');

// Get blocked IPs
router.get('/blocked-ips', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const activeOnly = req.query.active !== 'false';
    const blockedIPs = await intrusionDetectionService.getBlockedIPs(orgId, activeOnly);

    res.json({ blocked_ips: blockedIPs });
  } catch (error) {
    console.error('Error fetching blocked IPs:', error);
    res.status(500).json({ message: 'Error fetching blocked IPs', error: error.message });
  }
});

// Block an IP manually
router.post('/blocked-ips', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { ip_address, reason, duration_minutes } = req.body;

    if (!ip_address) {
      return res.status(400).json({ message: 'IP address is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const block = await intrusionDetectionService.blockIP(
      ip_address,
      duration_minutes || null,
      reason || 'Manual block by admin',
      req.user.id,
      orgId
    );

    res.status(201).json({ message: 'IP blocked', block });
  } catch (error) {
    console.error('Error blocking IP:', error);
    res.status(500).json({ message: 'Error blocking IP', error: error.message });
  }
});

// Unblock an IP
router.delete('/blocked-ips/:ip', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const success = await intrusionDetectionService.unblockIP(
      decodeURIComponent(req.params.ip),
      orgId
    );

    if (!success) {
      return res.status(404).json({ message: 'Blocked IP not found' });
    }

    res.json({ message: 'IP unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    res.status(500).json({ message: 'Error unblocking IP', error: error.message });
  }
});

// Get threat metrics
router.get('/threat-metrics', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const metrics = await intrusionDetectionService.getThreatMetrics(orgId);

    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching threat metrics:', error);
    res.status(500).json({ message: 'Error fetching threat metrics', error: error.message });
  }
});

// Get threat score for an IP
router.get('/threat-score/:ip', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const score = intrusionDetectionService.getThreatScore(
      decodeURIComponent(req.params.ip)
    );

    res.json({ threat_score: score });
  } catch (error) {
    console.error('Error fetching threat score:', error);
    res.status(500).json({ message: 'Error fetching threat score', error: error.message });
  }
});

module.exports = router;


