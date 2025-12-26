/**
 * User Invitation Service
 * Handles sending invitation emails to new users when they're added to organizations
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const reminderService = require('./reminderService');
const reminderConfigService = require('./reminderConfigService');

class UserInvitationService {
  /**
   * Generate a secure temporary password
   */
  generateTemporaryPassword() {
    // Generate a random 12-character password with mix of letters, numbers, and symbols
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Get email transporter (uses organization config or global config)
   */
  async getEmailTransporter(organizationId) {
    // Try organization-specific config first
    if (organizationId) {
      const transporter = await reminderService.getEmailTransporter(organizationId);
      if (transporter) {
        return transporter;
      }
    }

    // Fall back to global SMTP config
    const nodemailer = require('nodemailer');
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD
      }
    };

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      return nodemailer.createTransport(emailConfig);
    }

    return null;
  }

  /**
   * Send invitation email to user
   */
  async sendInvitationEmail(user, organization, temporaryPassword, invitedBy) {
    try {
      const transporter = await this.getEmailTransporter(organization.id);
      
      if (!transporter) {
        console.warn('Email transporter not configured. Invitation email will not be sent.');
        return {
          success: false,
          error: 'Email service not configured. Please configure SMTP settings in Settings → Reminders.'
        };
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/login`;

      // Get organization name or use default
      const orgName = organization.name || 'Your Organization';
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ehealthmedai.com';
      const fromName = process.env.SMTP_FROM_NAME || 'EHealth Med AI';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: user.email,
        subject: `Welcome to ${orgName} - Your Account Has Been Created`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .credentials { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
              .credential-item { margin: 15px 0; }
              .label { font-weight: bold; color: #6b7280; font-size: 14px; }
              .value { font-size: 18px; color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; }
              .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to ${orgName}</h1>
              </div>
              <div class="content">
                <p>Hello ${user.first_name || 'there'},</p>
                
                <p>Your account has been created for <strong>${orgName}</strong> by ${invitedBy || 'an administrator'}.</p>
                
                <p>You can now access your dashboard using the following credentials:</p>
                
                <div class="credentials">
                  <div class="credential-item">
                    <div class="label">Email:</div>
                    <div class="value">${user.email}</div>
                  </div>
                  <div class="credential-item">
                    <div class="label">Temporary Password:</div>
                    <div class="value">${temporaryPassword}</div>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Important:</strong> Please change your password after your first login for security.
                </div>

                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">Login to Dashboard</a>
                </div>

                <p>If you have any questions or need assistance, please contact your administrator.</p>

                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                  <p>© ${new Date().getFullYear()} EHealth Med AI. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Welcome to ${orgName}

Hello ${user.first_name || 'there'},

Your account has been created for ${orgName} by ${invitedBy || 'an administrator'}.

You can now access your dashboard using the following credentials:

Email: ${user.email}
Temporary Password: ${temporaryPassword}

⚠️ Important: Please change your password after your first login for security.

Login URL: ${loginUrl}

If you have any questions or need assistance, please contact your administrator.

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} EHealth Med AI. All rights reserved.
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Invitation email sent successfully:', info.messageId);

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending invitation email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send invitation email'
      };
    }
  }

  /**
   * Create user and send invitation email
   */
  async inviteUserToOrganization(userData, organizationId, invitedBy) {
    try {
      const { email, firstName, lastName, role = 'user' } = userData;

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Check if user already exists
      const existingUser = await db.query('SELECT id, organization_id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];
        if (existing.organization_id === organizationId) {
          throw new Error('User is already a member of this organization');
        }
        // User exists but in different organization - update their organization
        await db.query('UPDATE users SET organization_id = $1 WHERE id = $2', [organizationId, existing.id]);
        return {
          success: true,
          user: existing,
          emailSent: false,
          message: 'User already exists and has been assigned to this organization'
        };
      }

      // Generate temporary password
      const temporaryPassword = this.generateTemporaryPassword();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(temporaryPassword, salt);

      // Get organization details
      const orgResult = await db.query('SELECT * FROM organizations WHERE id = $1', [organizationId]);
      if (orgResult.rows.length === 0) {
        throw new Error('Organization not found');
      }
      const organization = orgResult.rows[0];

      // Create user
      const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, organization_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, email, first_name, last_name, role, is_active, organization_id, created_at`,
        [email, passwordHash, firstName, lastName, role, true, organizationId]
      );

      const newUser = result.rows[0];

      // Send invitation email
      const emailResult = await this.sendInvitationEmail(newUser, organization, temporaryPassword, invitedBy);

      // Log action
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [
          invitedBy.id,
          'INVITE_USER',
          'users',
          newUser.id,
          JSON.stringify({ 
            email, 
            organization_id: organizationId, 
            organization_name: organization.name,
            email_sent: emailResult.success 
          })
        ]
      );

      return {
        success: true,
        user: newUser,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        temporaryPassword: emailResult.success ? undefined : temporaryPassword // Only return password if email failed
      };
    } catch (error) {
      console.error('Error inviting user to organization:', error);
      throw error;
    }
  }
}

module.exports = new UserInvitationService();

