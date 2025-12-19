/**
 * Reminder Service
 * Handles sending SMS and email reminders for appointments
 */

const twilio = require('twilio');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const reminderConfigService = require('./reminderConfigService');

class ReminderService {
  /**
   * Get Twilio client for organization
   */
  async getTwilioClient(organizationId) {
    const config = await reminderConfigService.getConfig(organizationId);
    
    // Use organization config if available, otherwise fall back to env
    const accountSid = config?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = config?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      return twilio(accountSid, authToken);
    }
    
    return null;
  }

  /**
   * Get email transporter for organization
   */
  async getEmailTransporter(organizationId) {
    const config = await reminderConfigService.getConfig(organizationId);
    
    // Use organization config if available, otherwise fall back to env
    const emailConfig = {
      host: config?.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: config?.smtp_port || parseInt(process.env.SMTP_PORT || '587'),
      secure: config?.smtp_secure !== undefined ? config.smtp_secure : (process.env.SMTP_SECURE === 'true'),
      auth: {
        user: config?.smtp_user || process.env.SMTP_USER,
        pass: config?.smtp_password || process.env.SMTP_PASS
      }
    };

    // Only create transporter if credentials are provided
    if (emailConfig.auth.user && emailConfig.auth.pass) {
      return nodemailer.createTransport(emailConfig);
    }

    return null;
  }

  /**
   * Send appointment reminder via SMS
   */
  async sendSMSReminder(appointment, organizationId) {
    const twilioClient = await this.getTwilioClient(organizationId);
    
    if (!twilioClient) {
      console.warn('Twilio client not initialized. SMS reminders will be logged only.');
      return {
        success: false,
        method: 'sms',
        error: 'SMS service not configured'
      };
    }

    if (!appointment.patient_phone) {
      return {
        success: false,
        method: 'sms',
        error: 'Patient phone number not provided'
      };
    }

    try {
      // Format appointment date
      const appointmentDate = new Date(appointment.appointment_date);
      const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      // Get organization's phone number for sending
      const config = await reminderConfigService.getConfig(organizationId);
      const phoneResult = await db.query(
        `SELECT phone_number FROM phone_numbers 
         WHERE organization_id = $1 AND is_active = true 
         LIMIT 1`,
        [organizationId]
      );

      const fromNumber = config?.twilio_phone_number || phoneResult.rows[0]?.phone_number || process.env.TWILIO_PHONE_NUMBER;

      if (!fromNumber) {
        throw new Error('No phone number configured for sending SMS');
      }

      // Compose reminder message
      const message = `Hello ${appointment.patient_name}, this is a reminder that you have an appointment on ${formattedDate}${appointment.appointment_type ? ` for ${appointment.appointment_type}` : ''}. Please reply CONFIRM to confirm or CANCEL to cancel.`;

      // Send SMS via Twilio
      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: appointment.patient_phone
      });

      // Log reminder in database
      await db.query(
        `INSERT INTO audit_logs (user_id, action, ip_address, details)
         VALUES (NULL, 'APPOINTMENT_REMINDER_SENT', NULL, $1)`,
        [JSON.stringify({
          appointment_id: appointment.id,
          method: 'sms',
          phone_number: appointment.patient_phone,
          twilio_message_sid: twilioMessage.sid,
          timestamp: new Date().toISOString()
        })]
      );

      return {
        success: true,
        method: 'sms',
        message_sid: twilioMessage.sid,
        status: twilioMessage.status
      };
    } catch (error) {
      console.error('Error sending SMS reminder:', error);
      return {
        success: false,
        method: 'sms',
        error: error.message
      };
    }
  }

  /**
   * Send appointment reminder via email
   */
  async sendEmailReminder(appointment, organizationId) {
    const emailTransporter = await this.getEmailTransporter(organizationId);
    
    if (!emailTransporter) {
      console.warn('Email transporter not initialized. Email reminders will be logged only.');
      return {
        success: false,
        method: 'email',
        error: 'Email service not configured'
      };
    }

    if (!appointment.patient_email) {
      return {
        success: false,
        method: 'email',
        error: 'Patient email not provided'
      };
    }

    try {
      // Format appointment date
      const appointmentDate = new Date(appointment.appointment_date);
      const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      // Get organization details for email
      const config = await reminderConfigService.getConfig(organizationId);
      const orgResult = await db.query(
        'SELECT name, email FROM organizations WHERE id = $1',
        [organizationId]
      );

      const organizationName = config?.smtp_from_name || orgResult.rows[0]?.name || 'Medical Practice';
      const fromEmail = config?.smtp_from_email || orgResult.rows[0]?.email || process.env.SMTP_USER || 'noreply@medicalpractice.com';

      // Compose email
      const mailOptions = {
        from: `"${organizationName}" <${fromEmail}>`,
        to: appointment.patient_email,
        subject: `Appointment Reminder - ${formattedDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Appointment Reminder</h2>
            <p>Hello ${appointment.patient_name},</p>
            <p>This is a reminder that you have an appointment scheduled:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              ${appointment.appointment_type ? `<p><strong>Type:</strong> ${appointment.appointment_type}</p>` : ''}
              ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
            </div>
            <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
            <p>Thank you,<br>${organizationName}</p>
          </div>
        `,
        text: `
          Appointment Reminder
          
          Hello ${appointment.patient_name},
          
          This is a reminder that you have an appointment scheduled:
          
          Date & Time: ${formattedDate}
          ${appointment.appointment_type ? `Type: ${appointment.appointment_type}\n` : ''}
          ${appointment.notes ? `Notes: ${appointment.notes}\n` : ''}
          
          If you need to reschedule or cancel, please contact us as soon as possible.
          
          Thank you,
          ${organizationName}
        `
      };

      // Send email
      const info = await emailTransporter.sendMail(mailOptions);

      console.log('Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        from: mailOptions.from,
        to: mailOptions.to
      });

      // Check if email was actually accepted
      if (info.rejected && info.rejected.length > 0) {
        throw new Error(`Email was rejected: ${info.rejected.join(', ')}`);
      }

      // Log reminder in database
      await db.query(
        `INSERT INTO audit_logs (user_id, action, ip_address, details)
         VALUES (NULL, 'APPOINTMENT_REMINDER_SENT', NULL, $1)`,
        [JSON.stringify({
          appointment_id: appointment.id,
          method: 'email',
          email: appointment.patient_email,
          message_id: info.messageId,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
          timestamp: new Date().toISOString()
        })]
      );

      return {
        success: true,
        method: 'email',
        message_id: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        details: `Email sent to ${info.accepted.join(', ')}. Message ID: ${info.messageId}`
      };
    } catch (error) {
      console.error('Error sending email reminder:', error);
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack
      });

      // Log failed attempt
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, ip_address, details)
           VALUES (NULL, 'APPOINTMENT_REMINDER_FAILED', NULL, $1)`,
          [JSON.stringify({
            appointment_id: appointment.id,
            method: 'email',
            email: appointment.patient_email,
            error: error.message,
            error_code: error.code,
            error_response: error.response,
            timestamp: new Date().toISOString()
          })]
        );
      } catch (logError) {
        console.error('Error logging failed reminder:', logError);
      }

      return {
        success: false,
        method: 'email',
        error: error.message,
        error_code: error.code,
        error_response: error.response,
        details: `Failed to send email: ${error.message}${error.code ? ` (Code: ${error.code})` : ''}`
      };
    }
  }

  /**
   * Send appointment reminder via SMS, email, or both
   */
  async sendAppointmentReminder(appointment, method = 'both', organizationId) {
    const results = [];

    if (method === 'sms' || method === 'both') {
      const smsResult = await this.sendSMSReminder(appointment, organizationId);
      results.push(smsResult);
    }

    if (method === 'email' || method === 'both') {
      const emailResult = await this.sendEmailReminder(appointment, organizationId);
      results.push(emailResult);
    }

    return results;
  }
}

module.exports = new ReminderService();

