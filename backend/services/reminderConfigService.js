/**
 * Reminder Configuration Service
 * Retrieves and manages reminder configuration from database
 */

const db = require('../config/database');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * Decrypt sensitive data
 */
function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

class ReminderConfigService {
  /**
   * Get reminder configuration for organization
   */
  async getConfig(organizationId) {
    try {
      const result = await db.query(
        'SELECT * FROM reminder_configurations WHERE organization_id = $1 AND is_active = true',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0];
      
      // Decrypt sensitive data
      return {
        ...config,
        twilio_auth_token: decrypt(config.twilio_auth_token_encrypted),
        smtp_password: decrypt(config.smtp_password_encrypted)
      };
    } catch (error) {
      console.error('Error fetching reminder configuration:', error);
      return null;
    }
  }

  /**
   * Check if SMS is configured and enabled
   */
  async isSMSEnabled(organizationId) {
    const config = await this.getConfig(organizationId);
    return config && config.twilio_enabled && config.twilio_account_sid && config.twilio_auth_token_encrypted;
  }

  /**
   * Check if Email is configured and enabled
   */
  async isEmailEnabled(organizationId) {
    const config = await this.getConfig(organizationId);
    return config && config.smtp_enabled && config.smtp_user && config.smtp_password_encrypted;
  }
}

module.exports = new ReminderConfigService();

