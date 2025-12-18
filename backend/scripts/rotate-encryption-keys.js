require('dotenv').config();
const db = require('../config/database');
const encryptionService = require('../services/encryptionService');

async function rotateExpiredKeys() {
  try {
    console.log('Starting encryption key rotation check...');

    const expiredKeys = await db.query(`
      SELECT * FROM encryption_keys 
      WHERE expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP 
        AND is_active = true
    `);

    console.log(`Found ${expiredKeys.rows.length} expired keys to rotate`);

    for (const key of expiredKeys.rows) {
      try {
        const newKey = encryptionService.generateKey();
        const masterKey = encryptionService.generateKeyFromEnv();
        const encryptedKey = encryptionService.encrypt(newKey.toString('hex'), masterKey);

        await db.query(`
          UPDATE encryption_keys 
          SET key_encrypted = $1,
              rotation_date = CURRENT_DATE,
              is_active = false,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [JSON.stringify(encryptedKey), key.id]);

        await db.query(`
          INSERT INTO encryption_keys (
            organization_id, key_name, key_type, algorithm, 
            key_encrypted, is_active, created_at
          )
          VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
        `, [
          key.organization_id,
          `${key.key_name}_rotated_${Date.now()}`,
          key.key_type,
          key.algorithm,
          JSON.stringify(encryptedKey)
        ]);

        await db.query(`
          INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
          VALUES (1, 'ROTATE_ENCRYPTION_KEY', 'encryption_keys', $1, $2)
        `, [key.id, JSON.stringify({ old_key_id: key.id, reason: 'Automatic rotation due to expiration' })]);

        console.log(`Rotated key ${key.id} (${key.key_name})`);
      } catch (error) {
        console.error(`Error rotating key ${key.id}:`, error);
      }
    }

    console.log('Encryption key rotation check completed');
  } catch (error) {
    console.error('Error in key rotation:', error);
    process.exit(1);
  }
}

async function rotateKeysBySchedule() {
  try {
    console.log('Starting scheduled encryption key rotation...');

    const keysToRotate = await db.query(`
      SELECT * FROM encryption_keys 
      WHERE rotation_date IS NULL 
        OR rotation_date < CURRENT_DATE - INTERVAL '90 days'
        AND is_active = true
    `);

    console.log(`Found ${keysToRotate.rows.length} keys due for rotation`);

    for (const key of keysToRotate.rows) {
      try {
        const newKey = encryptionService.generateKey();
        const masterKey = encryptionService.generateKeyFromEnv();
        const encryptedKey = encryptionService.encrypt(newKey.toString('hex'), masterKey);

        await db.query(`
          UPDATE encryption_keys 
          SET key_encrypted = $1,
              rotation_date = CURRENT_DATE,
              is_active = false,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [JSON.stringify(encryptedKey), key.id]);

        await db.query(`
          INSERT INTO encryption_keys (
            organization_id, key_name, key_type, algorithm, 
            key_encrypted, is_active, created_at
          )
          VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
        `, [
          key.organization_id,
          `${key.key_name}_rotated_${Date.now()}`,
          key.key_type,
          key.algorithm,
          JSON.stringify(encryptedKey)
        ]);

        console.log(`Rotated key ${key.id} (${key.key_name})`);
      } catch (error) {
        console.error(`Error rotating key ${key.id}:`, error);
      }
    }

    console.log('Scheduled encryption key rotation completed');
  } catch (error) {
    console.error('Error in scheduled key rotation:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  const mode = process.argv[2] || 'expired';

  if (mode === 'expired') {
    rotateExpiredKeys().then(() => process.exit(0));
  } else if (mode === 'schedule') {
    rotateKeysBySchedule().then(() => process.exit(0));
  } else {
    console.log('Usage: node rotate-encryption-keys.js [expired|schedule]');
    process.exit(1);
  }
}

module.exports = { rotateExpiredKeys, rotateKeysBySchedule };

