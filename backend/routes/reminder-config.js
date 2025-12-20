const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');
const crypto = require('crypto');
const reminderService = require('../services/reminderService');

// Encryption key for sensitive data (should be in env in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

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

// Get reminder configuration for organization
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!orgId) {
      return res.status(400).json({ message: 'User must belong to an organization' });
    }

    const result = await db.query(
      'SELECT * FROM reminder_configurations WHERE organization_id = $1',
      [orgId]
    );

    if (result.rows.length === 0) {
      // Return empty config if none exists
      return res.json({
        config: {
          organization_id: orgId,
          twilio_enabled: false,
          smtp_enabled: false
        }
      });
    }

    const config = result.rows[0];
    
    // Don't send encrypted tokens/passwords in GET response for security
    // Only show if they're configured (not null)
    const safeConfig = {
      id: config.id,
      organization_id: config.organization_id,
      twilio_account_sid: config.twilio_account_sid ? '***configured***' : null,
      twilio_phone_number: config.twilio_phone_number,
      twilio_enabled: config.twilio_enabled,
      smtp_host: config.smtp_host,
      smtp_port: config.smtp_port,
      smtp_secure: config.smtp_secure,
      smtp_user: config.smtp_user,
      smtp_from_name: config.smtp_from_name,
      smtp_from_email: config.smtp_from_email,
      smtp_enabled: config.smtp_enabled,
      last_sms_test_at: config.last_sms_test_at,
      last_sms_test_status: config.last_sms_test_status,
      last_email_test_at: config.last_email_test_at,
      last_email_test_status: config.last_email_test_status,
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    res.json({ config: safeConfig });
  } catch (error) {
    console.error('Error fetching reminder configuration:', error);
    res.status(500).json({ message: 'Error fetching reminder configuration', error: error.message });
  }
});

// Create or update reminder configuration
router.put('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!orgId) {
      return res.status(400).json({ message: 'User must belong to an organization' });
    }

    const {
      twilio_account_sid,
      twilio_auth_token,
      twilio_phone_number,
      twilio_enabled,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_password,
      smtp_from_name,
      smtp_from_email,
      smtp_enabled
    } = req.body;

    // Check if config exists
    const existingResult = await db.query(
      'SELECT id FROM reminder_configurations WHERE organization_id = $1',
      [orgId]
    );

    let encryptedAuthToken = null;
    let encryptedSmtpPassword = null;

    // Only encrypt if new values are provided (not updating to null)
    if (twilio_auth_token && twilio_auth_token !== '***configured***') {
      encryptedAuthToken = encrypt(twilio_auth_token);
    } else if (existingResult.rows.length > 0) {
      // Keep existing encrypted token if not updating
      const existingConfig = await db.query(
        'SELECT twilio_auth_token_encrypted FROM reminder_configurations WHERE organization_id = $1',
        [orgId]
      );
      encryptedAuthToken = existingConfig.rows[0]?.twilio_auth_token_encrypted || null;
    }

    if (smtp_password && smtp_password !== '***configured***') {
      encryptedSmtpPassword = encrypt(smtp_password);
    } else if (existingResult.rows.length > 0) {
      // Keep existing encrypted password if not updating
      const existingConfig = await db.query(
        'SELECT smtp_password_encrypted FROM reminder_configurations WHERE organization_id = $1',
        [orgId]
      );
      encryptedSmtpPassword = existingConfig.rows[0]?.smtp_password_encrypted || null;
    }

    if (existingResult.rows.length > 0) {
      // Update existing config
      // Build update query dynamically, only updating fields that are provided and not "***configured***"
      const updates = [];
      const params = [];
      let paramCount = 0;

      if (twilio_account_sid !== undefined && twilio_account_sid !== '***configured***') {
        paramCount++;
        updates.push(`twilio_account_sid = $${paramCount}`);
        params.push(twilio_account_sid);
      }

      if (encryptedAuthToken !== null) {
        paramCount++;
        updates.push(`twilio_auth_token_encrypted = $${paramCount}`);
        params.push(encryptedAuthToken);
      }

      if (twilio_phone_number !== undefined) {
        paramCount++;
        updates.push(`twilio_phone_number = $${paramCount}`);
        params.push(twilio_phone_number || null);
      }

      if (twilio_enabled !== undefined) {
        paramCount++;
        updates.push(`twilio_enabled = $${paramCount}`);
        params.push(twilio_enabled);
      }

      if (smtp_host !== undefined) {
        paramCount++;
        updates.push(`smtp_host = $${paramCount}`);
        params.push(smtp_host || null);
      }

      if (smtp_port !== undefined) {
        paramCount++;
        updates.push(`smtp_port = $${paramCount}`);
        params.push(smtp_port || null);
      }

      if (smtp_secure !== undefined) {
        paramCount++;
        updates.push(`smtp_secure = $${paramCount}`);
        params.push(smtp_secure);
      }

      if (smtp_user !== undefined) {
        paramCount++;
        updates.push(`smtp_user = $${paramCount}`);
        params.push(smtp_user || null);
      }

      if (encryptedSmtpPassword !== null) {
        paramCount++;
        updates.push(`smtp_password_encrypted = $${paramCount}`);
        params.push(encryptedSmtpPassword);
      }

      if (smtp_from_name !== undefined) {
        paramCount++;
        updates.push(`smtp_from_name = $${paramCount}`);
        params.push(smtp_from_name || null);
      }

      if (smtp_from_email !== undefined) {
        paramCount++;
        updates.push(`smtp_from_email = $${paramCount}`);
        params.push(smtp_from_email || null);
      }

      if (smtp_enabled !== undefined) {
        paramCount++;
        updates.push(`smtp_enabled = $${paramCount}`);
        params.push(smtp_enabled);
      }

      // Always update updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');

      paramCount++;
      params.push(orgId);

      const updateQuery = `UPDATE reminder_configurations SET ${updates.join(', ')} WHERE organization_id = $${paramCount} RETURNING *`;
      const result = await db.query(updateQuery, params);

      res.json({ 
        config: result.rows[0],
        message: 'Reminder configuration updated successfully'
      });
    } else {
      // Create new config
      const result = await db.query(
        `INSERT INTO reminder_configurations (
          organization_id,
          twilio_account_sid, twilio_auth_token_encrypted, twilio_phone_number, twilio_enabled,
          smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_encrypted,
          smtp_from_name, smtp_from_email, smtp_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          orgId,
          twilio_account_sid || null,
          encryptedAuthToken,
          twilio_phone_number || null,
          twilio_enabled || false,
          smtp_host || 'smtp.gmail.com',
          smtp_port || 587,
          smtp_secure || false,
          smtp_user || null,
          encryptedSmtpPassword,
          smtp_from_name || null,
          smtp_from_email || null,
          smtp_enabled || false
        ]
      );

      res.status(201).json({ 
        config: result.rows[0],
        message: 'Reminder configuration created successfully'
      });
    }
  } catch (error) {
    console.error('Error saving reminder configuration:', error);
    res.status(500).json({ message: 'Error saving reminder configuration', error: error.message });
  }
});

// Test SMS configuration
router.post('/test-sms', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { test_phone_number } = req.body;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!orgId) {
      return res.status(400).json({ message: 'User must belong to an organization' });
    }

    // Get config with decrypted token
    const configResult = await db.query(
      'SELECT * FROM reminder_configurations WHERE organization_id = $1',
      [orgId]
    );

    if (configResult.rows.length === 0 || !configResult.rows[0].twilio_enabled) {
      return res.status(400).json({ message: 'SMS configuration not enabled' });
    }

    const config = configResult.rows[0];
    const decryptedToken = decrypt(config.twilio_auth_token_encrypted);

    if (!decryptedToken) {
      return res.status(400).json({ message: 'Twilio auth token not configured or invalid' });
    }

    // Test SMS sending
    const twilio = require('twilio');
    const twilioClient = twilio(config.twilio_account_sid, decryptedToken);

    try {
      const message = await twilioClient.messages.create({
        body: 'Test message from EHealth Med AI - Reminder configuration test',
        from: config.twilio_phone_number,
        to: test_phone_number
      });

      // Update test results
      await db.query(
        `UPDATE reminder_configurations SET
          last_sms_test_at = CURRENT_TIMESTAMP,
          last_sms_test_status = 'success',
          last_sms_test_message = $1
        WHERE organization_id = $2`,
        [`Test SMS sent successfully. Message SID: ${message.sid}`, orgId]
      );

      res.json({ 
        success: true,
        message: 'Test SMS sent successfully',
        message_sid: message.sid
      });
    } catch (twilioError) {
      // Update test results with error
      await db.query(
        `UPDATE reminder_configurations SET
          last_sms_test_at = CURRENT_TIMESTAMP,
          last_sms_test_status = 'failed',
          last_sms_test_message = $1
        WHERE organization_id = $2`,
        [twilioError.message || 'Unknown error', orgId]
      );

      res.status(400).json({ 
        success: false,
        message: 'Failed to send test SMS',
        error: twilioError.message
      });
    }
  } catch (error) {
    console.error('Error testing SMS:', error);
    res.status(500).json({ message: 'Error testing SMS', error: error.message });
  }
});

// Test Email configuration
router.post('/test-email', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { test_email } = req.body;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    if (!orgId) {
      return res.status(400).json({ message: 'User must belong to an organization' });
    }

    // Get config with decrypted password
    const configResult = await db.query(
      'SELECT * FROM reminder_configurations WHERE organization_id = $1',
      [orgId]
    );

    if (configResult.rows.length === 0 || !configResult.rows[0].smtp_enabled) {
      return res.status(400).json({ message: 'Email configuration not enabled' });
    }

    const config = configResult.rows[0];
    const decryptedPassword = decrypt(config.smtp_password_encrypted);

    if (!decryptedPassword) {
      return res.status(400).json({ message: 'SMTP password not configured or invalid' });
    }

    // Test email sending
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: decryptedPassword
      }
    });

    try {
      const info = await transporter.sendMail({
        from: `"${config.smtp_from_name || 'EHealth Med AI'}" <${config.smtp_from_email || config.smtp_user}>`,
        to: test_email,
        subject: 'Test Email from EHealth Med AI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reminder Configuration Test</h2>
            <p>This is a test email from your EHealth Med AI reminder configuration.</p>
            <p>If you received this email, your SMTP configuration is working correctly.</p>
          </div>
        `,
        text: 'This is a test email from your EHealth Med AI reminder configuration. If you received this email, your SMTP configuration is working correctly.'
      });

      // Update test results
      await db.query(
        `UPDATE reminder_configurations SET
          last_email_test_at = CURRENT_TIMESTAMP,
          last_email_test_status = 'success',
          last_email_test_message = $1
        WHERE organization_id = $2`,
        [`Test email sent successfully. Message ID: ${info.messageId}`, orgId]
      );

      res.json({ 
        success: true,
        message: 'Test email sent successfully',
        message_id: info.messageId
      });
    } catch (emailError) {
      // Update test results with error
      await db.query(
        `UPDATE reminder_configurations SET
          last_email_test_at = CURRENT_TIMESTAMP,
          last_email_test_status = 'failed',
          last_email_test_message = $1
        WHERE organization_id = $2`,
        [emailError.message || 'Unknown error', orgId]
      );

      res.status(400).json({ 
        success: false,
        message: 'Failed to send test email',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ message: 'Error testing email', error: error.message });
  }
});

module.exports = router;

