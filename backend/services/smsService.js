/**
 * SMS Service
 * Handles sending and receiving SMS messages via Twilio
 */

const twilio = require('twilio');
const db = require('../config/database');
const reminderConfigService = require('./reminderConfigService');

class SMSService {
  /**
   * Get Twilio client for organization
   */
  async getTwilioClient(organizationId) {
    const config = await reminderConfigService.getConfig(organizationId);
    
    const accountSid = config?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = config?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      return twilio(accountSid, authToken);
    }
    
    return null;
  }

  /**
   * Send SMS message
   */
  async sendSMS({ organizationId, to, from, message, conversationId = null }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured for this organization');
      }

      // Get phone number if not provided
      if (!from) {
        const config = await reminderConfigService.getConfig(organizationId);
        from = config?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;
      }

      if (!from) {
        throw new Error('From phone number is required');
      }

      // Send SMS via Twilio
      const twilioMessage = await twilioClient.messages.create({
        to: to,
        from: from,
        body: message
      });

      // Log SMS in database
      await db.query(
        `INSERT INTO sms_messages (
          organization_id, conversation_id, to_number, from_number,
          message_body, provider_message_id, status, direction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'outbound')
        RETURNING *`,
        [
          organizationId,
          conversationId,
          to,
          from,
          message,
          twilioMessage.sid,
          twilioMessage.status
        ]
      );

      return {
        success: true,
        messageSid: twilioMessage.sid,
        status: twilioMessage.status
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Handle incoming SMS webhook
   */
  async handleIncomingSMS(req, res) {
    try {
      const { From, To, Body, MessageSid } = req.body;

      // Find organization by phone number
      const phoneResult = await db.query(
        'SELECT organization_id FROM phone_numbers WHERE phone_number = $1',
        [To]
      );

      if (phoneResult.rows.length === 0) {
        console.warn(`Incoming SMS to unknown number: ${To}`);
        return res.status(200).send('OK');
      }

      const organizationId = phoneResult.rows[0].organization_id;

      // Save incoming SMS
      const smsResult = await db.query(
        `INSERT INTO sms_messages (
          organization_id, to_number, from_number,
          message_body, provider_message_id, status, direction
        ) VALUES ($1, $2, $3, $4, $5, $6, 'inbound')
        RETURNING *`,
        [
          organizationId,
          To,
          From,
          Body,
          MessageSid,
          'received'
        ]
      );

      // Try to find or create conversation
      let conversationResult = await db.query(
        `SELECT id FROM conversations 
         WHERE patient_phone = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [From, organizationId]
      );

      let conversationId = null;
      if (conversationResult.rows.length > 0) {
        conversationId = conversationResult.rows[0].id;
      } else {
        // Create new conversation for SMS
        const newConversation = await db.query(
          `INSERT INTO conversations (organization_id, patient_phone, status, transcript)
           VALUES ($1, $2, 'active', $3)
           RETURNING id`,
          [organizationId, From, JSON.stringify([{
            role: 'user',
            content: Body,
            timestamp: new Date().toISOString()
          }])]
        );
        conversationId = newConversation.rows[0].id;
      }

      // Update SMS with conversation ID
      await db.query(
        'UPDATE sms_messages SET conversation_id = $1 WHERE id = $2',
        [conversationId, smsResult.rows[0].id]
      );

      // Process with AI agent if configured
      // This could trigger an automated response
      // For now, just log it

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling incoming SMS:', error);
      res.status(200).send('OK'); // Always return OK to Twilio
    }
  }

  /**
   * Get SMS messages for organization
   */
  async getSMSMessages(organizationId, filters = {}) {
    try {
      let query = `
        SELECT * FROM sms_messages
        WHERE organization_id = $1
      `;
      const params = [organizationId];
      let paramCount = 1;

      if (filters.conversationId) {
        paramCount++;
        query += ` AND conversation_id = $${paramCount}`;
        params.push(filters.conversationId);
      }

      if (filters.direction) {
        paramCount++;
        query += ` AND direction = $${paramCount}`;
        params.push(filters.direction);
      }

      if (filters.startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(filters.limit || 50, filters.offset || 0);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching SMS messages:', error);
      return [];
    }
  }
}

module.exports = new SMSService();

