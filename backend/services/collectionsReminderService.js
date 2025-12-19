/**
 * Collections Reminder Service
 * Automated reminder system for overdue balances
 */

const db = require('../config/database');
const reminderService = require('./reminderService');

class CollectionsReminderService {
  /**
   * Create overdue balance reminder
   */
  async createOverdueReminder(statementId, reminderData, organizationId) {
    try {
      // Get statement information
      const statementResult = await db.query(
        'SELECT * FROM patient_statements WHERE id = $1',
        [statementId]
      );

      if (statementResult.rows.length === 0) {
        throw new Error('Statement not found');
      }

      const statement = statementResult.rows[0];

      // Calculate days overdue
      const dueDate = statement.due_date ? new Date(statement.due_date) : null;
      const today = new Date();
      const daysOverdue = dueDate ? Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))) : 0;

      // Check TCPA compliance before sending
      const isTCPACompliant = await this.checkTCPACompliance(statement.patient_phone, organizationId, reminderData.reminder_type);
      
      if (!isTCPACompliant && reminderData.reminder_type === 'call' || reminderData.reminder_type === 'sms') {
        throw new Error('Cannot send reminder: TCPA compliance check failed. Patient may be on Do Not Call list or has not consented.');
      }

      // Generate reminder content
      const reminderContent = this.generateReminderContent(statement, daysOverdue, reminderData.reminder_type);

      // Schedule reminder
      const scheduledDate = reminderData.scheduled_send_date || new Date();
      
      const result = await db.query(
        `INSERT INTO overdue_balance_reminders (
          statement_id, patient_name, patient_phone, patient_email,
          balance_amount, days_overdue, reminder_type, scheduled_send_date,
          reminder_content, consent_verified, tcp_compliant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          statementId,
          statement.patient_name,
          statement.patient_phone,
          statement.patient_email,
          statement.balance_due,
          daysOverdue,
          reminderData.reminder_type || 'email',
          scheduledDate,
          reminderContent,
          isTCPACompliant,
          isTCPACompliant
        ]
      );

      const reminder = result.rows[0];

      // Log activity
      await this.logActivity(organizationId, statementId, 'reminder_scheduled', {
        reminder_id: reminder.id,
        reminder_type: reminder.reminder_type,
        balance_amount: statement.balance_due,
        days_overdue: daysOverdue
      }, statement);

      return reminder;
    } catch (error) {
      console.error('Error creating overdue reminder:', error);
      throw error;
    }
  }

  /**
   * Send overdue reminder
   */
  async sendOverdueReminder(reminderId, organizationId) {
    try {
      const reminderResult = await db.query(
        'SELECT * FROM overdue_balance_reminders WHERE id = $1',
        [reminderId]
      );

      if (reminderResult.rows.length === 0) {
        throw new Error('Reminder not found');
      }

      const reminder = reminderResult.rows[0];

      if (reminder.reminder_status !== 'pending') {
        throw new Error(`Reminder already ${reminder.reminder_status}`);
      }

      let sent = false;

      // Send based on reminder type
      switch (reminder.reminder_type) {
        case 'sms':
          sent = await this.sendSMSReminder(reminder, organizationId);
          break;
        case 'email':
          sent = await this.sendEmailReminder(reminder, organizationId);
          break;
        case 'call':
          // For automated calls, this would integrate with telephony service
          // For now, we'll mark it as requiring manual action
          sent = false;
          break;
        case 'letter':
          // For physical letters, this would integrate with mail service
          sent = false;
          break;
        default:
          throw new Error(`Unsupported reminder type: ${reminder.reminder_type}`);
      }

      // Update reminder status
      await db.query(
        `UPDATE overdue_balance_reminders 
         SET reminder_status = $1, sent_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [sent ? 'sent' : 'failed', sent ? new Date() : null, reminderId]
      );

      // Log activity
      if (sent) {
        await this.logActivity(organizationId, reminder.statement_id, 'reminder_sent', {
          reminder_id: reminderId,
          reminder_type: reminder.reminder_type
        }, {
          patient_name: reminder.patient_name,
          patient_phone: reminder.patient_phone,
          patient_email: reminder.patient_email
        });
      }

      return { success: sent, reminder };
    } catch (error) {
      console.error('Error sending overdue reminder:', error);
      throw error;
    }
  }

  /**
   * Send SMS reminder
   */
  async sendSMSReminder(reminder, organizationId) {
    try {
      const message = reminder.reminder_content || `Reminder: You have an overdue balance of $${parseFloat(reminder.balance_amount).toFixed(2)}. Please contact us to arrange payment.`;

      const smsResult = await reminderService.sendSMSReminder(
        {
          patient_name: reminder.patient_name,
          patient_phone: reminder.patient_phone,
          appointment_date: new Date(),
          appointment_type: 'Balance Reminder'
        },
        organizationId,
        message
      );

      return smsResult.success || false;
    } catch (error) {
      console.error('Error sending SMS reminder:', error);
      return false;
    }
  }

  /**
   * Send email reminder
   */
  async sendEmailReminder(reminder, organizationId) {
    try {
      if (!reminder.patient_email) {
        return false;
      }

      const subject = `Overdue Balance Reminder - $${parseFloat(reminder.balance_amount).toFixed(2)}`;
      const htmlContent = this.generateEmailReminderHTML(reminder);

      const emailResult = await reminderService.sendEmailReminder(
        {
          patient_name: reminder.patient_name,
          patient_email: reminder.patient_email,
          appointment_date: new Date(),
          appointment_type: 'Balance Reminder'
        },
        organizationId,
        subject,
        htmlContent
      );

      return emailResult.success || false;
    } catch (error) {
      console.error('Error sending email reminder:', error);
      return false;
    }
  }

  /**
   * Generate reminder content
   */
  generateReminderContent(statement, daysOverdue, reminderType) {
    const balance = parseFloat(statement.balance_due).toFixed(2);
    
    if (reminderType === 'sms') {
      return `Reminder: You have an overdue balance of $${balance}${daysOverdue > 0 ? ` (${daysOverdue} days overdue)` : ''}. Please contact us to arrange payment or set up a payment plan.`;
    } else {
      return `Dear ${statement.patient_name},\n\nThis is a reminder that you have an overdue balance of $${balance}${daysOverdue > 0 ? ` (${daysOverdue} days overdue)` : ''}.\n\nPlease contact us to arrange payment or discuss payment plan options.\n\nThank you.`;
    }
  }

  /**
   * Generate email reminder HTML
   */
  generateEmailReminderHTML(reminder) {
    const balance = parseFloat(reminder.balance_amount).toFixed(2);
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Overdue Balance Reminder</h2>
          <p>Dear ${reminder.patient_name},</p>
          <p>This is a reminder that you have an overdue balance of <strong>$${balance}</strong>${reminder.days_overdue > 0 ? ` (${reminder.days_overdue} days overdue)` : ''}.</p>
          <p>We encourage you to contact us to arrange payment or discuss payment plan options that may be available to you.</p>
          <p>Please call us at your earliest convenience to resolve this matter.</p>
          <p>Thank you for your attention to this matter.</p>
        </body>
      </html>
    `;
  }

  /**
   * Check TCPA compliance
   */
  async checkTCPACompliance(phoneNumber, organizationId, reminderType) {
    if (!phoneNumber) return true; // Email reminders don't need TCPA check
    
    // Check Do Not Call list
    const dncResult = await db.query(
      'SELECT * FROM do_not_call_list WHERE organization_id = $1 AND phone_number = $2 AND verified = true',
      [organizationId, phoneNumber]
    );

    if (dncResult.rows.length > 0) {
      return false; // On Do Not Call list
    }

    // Check consent records
    if (reminderType === 'sms' || reminderType === 'call') {
      const consentResult = await db.query(
        `SELECT * FROM collections_consent_records 
         WHERE organization_id = $1 
         AND patient_identifier = $2 
         AND consent_type = $3
         AND consent_status = 'granted'
         AND (expiration_date IS NULL OR expiration_date > CURRENT_TIMESTAMP)
         ORDER BY consent_date DESC
         LIMIT 1`,
        [organizationId, phoneNumber, reminderType === 'sms' ? 'sms' : 'call']
      );

      if (consentResult.rows.length === 0) {
        // No consent record - for collections, implied consent may apply for existing customers
        // But explicit consent is safer
        return false;
      }

      return true;
    }

    return true; // Email reminders don't require TCPA consent
  }

  /**
   * Get overdue statements for automated reminders
   */
  async getOverdueStatements(organizationId, daysOverdue = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

      const result = await db.query(
        `SELECT ps.*, 
                (SELECT COUNT(*) FROM overdue_balance_reminders WHERE statement_id = ps.id AND reminder_status = 'sent') as reminder_count
         FROM patient_statements ps
         LEFT JOIN conversations c ON ps.conversation_id = c.id
         WHERE (c.organization_id = $1 OR c.organization_id IS NULL)
         AND ps.status IN ('pending', 'overdue', 'partial')
         AND ps.balance_due > 0
         AND ps.due_date < CURRENT_DATE
         AND (ps.due_date >= $2 OR ps.due_date IS NULL)
         ORDER BY ps.due_date ASC`,
        [organizationId, cutoffDate]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting overdue statements:', error);
      return [];
    }
  }

  /**
   * Log collections activity
   */
  async logActivity(organizationId, statementId, activityType, metadata, patientInfo) {
    try {
      await db.query(
        `INSERT INTO collections_activity_log (
          organization_id, statement_id, activity_type, activity_description,
          patient_name, patient_phone, patient_email, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          statementId,
          activityType,
          metadata.activity_description || `${activityType} for statement ${statementId}`,
          patientInfo.patient_name,
          patientInfo.patient_phone || null,
          patientInfo.patient_email || null,
          JSON.stringify(metadata)
        ]
      );
    } catch (error) {
      console.error('Error logging collections activity:', error);
    }
  }

  /**
   * Get collections reminder functions for OpenAI function calling
   */
  getReminderFunctions() {
    return [
      {
        name: 'send_overdue_balance_reminder',
        description: 'Send an automated reminder to a patient about their overdue balance. Use this when a patient has an overdue balance and needs a reminder.',
        parameters: {
          type: 'object',
          properties: {
            statement_id: {
              type: 'number',
              description: 'ID of the statement with overdue balance'
            },
            reminder_type: {
              type: 'string',
              description: 'Type of reminder to send',
              enum: ['email', 'sms', 'call', 'letter']
            },
            scheduled_send_date: {
              type: 'string',
              description: 'When to send the reminder (ISO 8601 format). If not provided, sends immediately.'
            }
          },
          required: ['statement_id', 'reminder_type']
        }
      }
    ];
  }
}

module.exports = new CollectionsReminderService();

