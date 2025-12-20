/**
 * Voicemail Service
 * Handles voicemail recording and retrieval
 */

const twilio = require('twilio');
const db = require('../config/database');
const reminderConfigService = require('./reminderConfigService');

class VoicemailService {
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
   * Handle voicemail recording webhook
   */
  async handleVoicemailRecording(req, res) {
    try {
      const { 
        CallSid, 
        RecordingUrl, 
        RecordingDuration, 
        RecordingSid,
        From,
        To
      } = req.body;

      // Find organization by phone number
      const phoneResult = await db.query(
        'SELECT organization_id FROM phone_numbers WHERE phone_number = $1',
        [To]
      );

      if (phoneResult.rows.length === 0) {
        console.warn(`Voicemail for unknown number: ${To}`);
        return res.status(200).send('OK');
      }

      const organizationId = phoneResult.rows[0].organization_id;

      // Get or create call log
      let callLogResult = await db.query(
        'SELECT id FROM call_logs WHERE provider_call_id = $1',
        [CallSid]
      );

      let callLogId = null;
      if (callLogResult.rows.length > 0) {
        callLogId = callLogResult.rows[0].id;
      } else {
        // Create call log for voicemail
        const newCallLog = await db.query(
          `INSERT INTO call_logs (
            organization_id, caller_phone, direction, status,
            provider_call_id, started_at
          ) VALUES ($1, $2, 'inbound', 'voicemail', $3, CURRENT_TIMESTAMP)
          RETURNING id`,
          [organizationId, From, CallSid]
        );
        callLogId = newCallLog.rows[0].id;
      }

      // Save voicemail recording
      const voicemailResult = await db.query(
        `INSERT INTO voicemails (
          organization_id, call_log_id, caller_phone, called_number,
          recording_url, recording_sid, duration_seconds, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'received')
        RETURNING *`,
        [
          organizationId,
          callLogId,
          From,
          To,
          RecordingUrl,
          RecordingSid,
          parseInt(RecordingDuration || 0)
        ]
      );

      // Update call log
      await db.query(
        `UPDATE call_logs 
         SET status = 'voicemail', 
             recording_url = $1,
             duration_seconds = $2
         WHERE id = $3`,
        [RecordingUrl, parseInt(RecordingDuration || 0), callLogId]
      );

      // Log voicemail received
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'VOICEMAIL_RECEIVED', 'voicemails', $1, $2)`,
        [
          voicemailResult.rows[0].id,
          JSON.stringify({
            caller: From,
            called: To,
            duration: RecordingDuration,
            recording_url: RecordingUrl,
            timestamp: new Date().toISOString()
          })
        ]
      );

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling voicemail recording:', error);
      res.status(200).send('OK'); // Always return OK to Twilio
    }
  }

  /**
   * Get voicemails for organization
   */
  async getVoicemails(organizationId, filters = {}) {
    try {
      let query = `
        SELECT v.*, cl.caller_name, cl.started_at as call_started_at
        FROM voicemails v
        LEFT JOIN call_logs cl ON v.call_log_id = cl.id
        WHERE v.organization_id = $1
      `;
      const params = [organizationId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        query += ` AND v.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        query += ` AND v.created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        query += ` AND v.created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY v.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(filters.limit || 50, filters.offset || 0);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching voicemails:', error);
      return [];
    }
  }

  /**
   * Mark voicemail as read/listened
   */
  async markVoicemailAsRead(voicemailId, organizationId) {
    try {
      await db.query(
        `UPDATE voicemails 
         SET status = 'read', read_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id = $2`,
        [voicemailId, organizationId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error marking voicemail as read:', error);
      throw error;
    }
  }

  /**
   * Delete voicemail
   */
  async deleteVoicemail(voicemailId, organizationId) {
    try {
      await db.query(
        `UPDATE voicemails 
         SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id = $2`,
        [voicemailId, organizationId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error deleting voicemail:', error);
      throw error;
    }
  }
}

module.exports = new VoicemailService();

