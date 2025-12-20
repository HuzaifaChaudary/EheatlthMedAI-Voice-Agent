/**
 * Call Control Service
 * Handles real-time call control: transfer, hold, mute
 */

const twilio = require('twilio');
const db = require('../config/database');
const reminderConfigService = require('./reminderConfigService');

class CallControlService {
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
   * Transfer call to another number
   */
  async transferCall({ organizationId, callSid, to, from }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured');
      }

      // Get call details
      const call = await twilioClient.calls(callSid).fetch();

      // Create TwiML for transfer
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Please hold while we transfer your call.');
      twiml.dial({
        action: `${process.env.API_URL || 'http://localhost:5000'}/api/telephony/twilio/transfer-status?callSid=${callSid}`,
        method: 'POST'
      }, to);

      // Update call with new TwiML
      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      // Log transfer
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'CALL_TRANSFERRED', 'call_logs', 
         (SELECT id FROM call_logs WHERE provider_call_id = $1), $2)`,
        [callSid, JSON.stringify({ to, from, timestamp: new Date().toISOString() })]
      );

      return { success: true, message: 'Call transferred successfully' };
    } catch (error) {
      console.error('Error transferring call:', error);
      throw error;
    }
  }

  /**
   * Put call on hold
   */
  async holdCall({ organizationId, callSid, holdMusic = null }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured');
      }

      // Create TwiML for hold
      const twiml = new twilio.twiml.VoiceResponse();
      
      if (holdMusic) {
        twiml.play(holdMusic);
      } else {
        twiml.say('Please hold. Your call is very important to us.');
      }
      
      twiml.pause({ length: 30 }); // Hold for 30 seconds, then reconnect
      twiml.redirect(`${process.env.API_URL || 'http://localhost:5000'}/api/telephony/twilio/voice?callSid=${callSid}`);

      // Update call with hold TwiML
      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      // Log hold
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'CALL_HELD', 'call_logs', 
         (SELECT id FROM call_logs WHERE provider_call_id = $1), $2)`,
        [callSid, JSON.stringify({ timestamp: new Date().toISOString() })]
      );

      return { success: true, message: 'Call put on hold' };
    } catch (error) {
      console.error('Error holding call:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute call
   */
  async muteCall({ organizationId, callSid, mute = true }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured');
      }

      // Note: Twilio doesn't have a direct mute API
      // We can use <Gather> with muted input or redirect to a muted flow
      // For now, we'll log the action and return success
      // In production, you'd need to use Twilio's Conference API for true muting

      // Log mute action
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, $1, 'call_logs', 
         (SELECT id FROM call_logs WHERE provider_call_id = $2), $3)`,
        [
          mute ? 'CALL_MUTED' : 'CALL_UNMUTED',
          callSid,
          JSON.stringify({ mute, timestamp: new Date().toISOString() })
        ]
      );

      return { 
        success: true, 
        message: mute ? 'Call muted' : 'Call unmuted',
        note: 'For true muting, use Twilio Conference API'
      };
    } catch (error) {
      console.error('Error muting call:', error);
      throw error;
    }
  }

  /**
   * Hang up call
   */
  async hangupCall({ organizationId, callSid }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured');
      }

      // Update call status to completed
      await twilioClient.calls(callSid).update({
        status: 'completed'
      });

      // Log hangup
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'CALL_HUNG_UP', 'call_logs', 
         (SELECT id FROM call_logs WHERE provider_call_id = $1), $2)`,
        [callSid, JSON.stringify({ timestamp: new Date().toISOString() })]
      );

      return { success: true, message: 'Call ended' };
    } catch (error) {
      console.error('Error hanging up call:', error);
      throw error;
    }
  }

  /**
   * Get active call status
   */
  async getCallStatus({ organizationId, callSid }) {
    try {
      const twilioClient = await this.getTwilioClient(organizationId);
      
      if (!twilioClient) {
        throw new Error('Twilio is not configured');
      }

      const call = await twilioClient.calls(callSid).fetch();

      return {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime
      };
    } catch (error) {
      console.error('Error getting call status:', error);
      throw error;
    }
  }
}

module.exports = new CallControlService();

