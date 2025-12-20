/**
 * API Key Service
 * Handles generation, validation, and management of API keys
 */

const crypto = require('crypto');
const db = require('../config/database');

const API_KEY_PREFIX = 'ehai_';
const KEY_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Generate a cryptographically secure API key
 * @returns {Object} { fullKey, prefix, hash }
 */
const generateApiKey = () => {
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  const keyBody = randomBytes.toString('base64url');
  const fullKey = `${API_KEY_PREFIX}${keyBody}`;
  const prefix = fullKey.substring(0, 12); // First 12 chars for display
  const hash = hashApiKey(fullKey);
  
  return { fullKey, prefix, hash };
};

/**
 * Hash an API key using SHA-256
 * @param {string} key - The full API key
 * @returns {string} Hashed key
 */
const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * Create a new API key for an organization
 * @param {number} organizationId - Organization ID
 * @param {string} name - Key name/description
 * @param {string[]} permissions - Array of permission scopes
 * @param {Date|null} expiresAt - Optional expiration date
 * @param {number} createdBy - User ID who created the key
 * @returns {Promise<Object>} Created key info (includes full key - only time it's shown)
 */
const createApiKey = async (organizationId, name, permissions = [], expiresAt = null, createdBy = null) => {
  const { fullKey, prefix, hash } = generateApiKey();
  
  const result = await db.query(
    `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, permissions, expires_at, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
     RETURNING id, name, key_prefix, permissions, expires_at, is_active, created_at`,
    [organizationId, name, hash, prefix, permissions, expiresAt]
  );
  
  // Log the creation
  if (createdBy) {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [createdBy, 'CREATE_API_KEY', 'api_keys', result.rows[0].id, JSON.stringify({ name, permissions })]
    );
  }
  
  return {
    ...result.rows[0],
    key: fullKey // Only returned on creation
  };
};

/**
 * Validate an API key
 * @param {string} key - The full API key to validate
 * @returns {Promise<Object|null>} Key data if valid, null otherwise
 */
const validateApiKey = async (key) => {
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  
  const hash = hashApiKey(key);
  
  const result = await db.query(
    `SELECT ak.*, o.name as organization_name, o.is_active as org_active
     FROM api_keys ak
     LEFT JOIN organizations o ON ak.organization_id = o.id
     WHERE ak.key_hash = $1`,
    [hash]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const keyData = result.rows[0];
  
  // Check if key is active
  if (!keyData.is_active) {
    return null;
  }
  
  // Check if organization is active
  if (keyData.org_active === false) {
    return null;
  }
  
  // Check expiration
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return null;
  }
  
  // Update last used timestamp
  await db.query(
    'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
    [keyData.id]
  );
  
  return keyData;
};

/**
 * Get all API keys for an organization (masked)
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object[]>} List of API keys (without full key)
 */
const getApiKeys = async (organizationId) => {
  const result = await db.query(
    `SELECT id, name, key_prefix, permissions, expires_at, last_used_at, is_active, created_at
     FROM api_keys
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  
  return result.rows;
};

/**
 * Revoke (deactivate) an API key
 * @param {number} keyId - API key ID
 * @param {number} organizationId - Organization ID (for verification)
 * @param {number} revokedBy - User ID who revoked the key
 * @returns {Promise<boolean>} Success status
 */
const revokeApiKey = async (keyId, organizationId, revokedBy = null) => {
  const result = await db.query(
    `UPDATE api_keys 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2
     RETURNING id`,
    [keyId, organizationId]
  );
  
  if (result.rows.length > 0 && revokedBy) {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [revokedBy, 'REVOKE_API_KEY', 'api_keys', keyId, JSON.stringify({ reason: 'manual_revocation' })]
    );
  }
  
  return result.rows.length > 0;
};

/**
 * Rotate an API key (create new, deactivate old)
 * @param {number} keyId - API key ID to rotate
 * @param {number} organizationId - Organization ID
 * @param {number} rotatedBy - User ID performing rotation
 * @returns {Promise<Object>} New key data
 */
const rotateApiKey = async (keyId, organizationId, rotatedBy = null) => {
  // Get old key details
  const oldKeyResult = await db.query(
    'SELECT name, permissions, expires_at FROM api_keys WHERE id = $1 AND organization_id = $2',
    [keyId, organizationId]
  );
  
  if (oldKeyResult.rows.length === 0) {
    throw new Error('API key not found');
  }
  
  const oldKey = oldKeyResult.rows[0];
  
  // Deactivate old key
  await revokeApiKey(keyId, organizationId, rotatedBy);
  
  // Create new key with same settings
  const newKey = await createApiKey(
    organizationId,
    `${oldKey.name} (rotated)`,
    oldKey.permissions,
    oldKey.expires_at,
    rotatedBy
  );
  
  // Log rotation
  if (rotatedBy) {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [rotatedBy, 'ROTATE_API_KEY', 'api_keys', newKey.id, JSON.stringify({ old_key_id: keyId, new_key_id: newKey.id })]
    );
  }
  
  return newKey;
};

/**
 * Delete an API key permanently
 * @param {number} keyId - API key ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<boolean>} Success status
 */
const deleteApiKey = async (keyId, organizationId) => {
  const result = await db.query(
    'DELETE FROM api_keys WHERE id = $1 AND organization_id = $2 RETURNING id',
    [keyId, organizationId]
  );
  
  return result.rows.length > 0;
};

module.exports = {
  generateApiKey,
  hashApiKey,
  createApiKey,
  validateApiKey,
  getApiKeys,
  revokeApiKey,
  rotateApiKey,
  deleteApiKey,
  API_KEY_PREFIX
};
