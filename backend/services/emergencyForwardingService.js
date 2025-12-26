/**
 * Emergency Forwarding Service
 * Handles forwarding calls to emergency contacts when AI detects emergency situation
 */

const db = require('../config/database');
const callControlService = require('./callControlService');

class EmergencyForwardingService {
  /**
   * Forward call to emergency contact
   */
  async forwardCall(conversationId, callLogId, reason, organizationId) {
    try {
      // Get conversation and agent
      const conversationResult = await db.query(
        'SELECT agent_id, patient_phone FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const conversation = conversationResult.rows[0];
      const agentId = conversation.agent_id;

      // Get agent emergency contact configuration
      const agentResult = await db.query(
        'SELECT escalation_rules, name FROM ai_agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agentResult.rows[0];
      const escalationRules = agent.escalation_rules || {};

      // Get emergency contact from escalation rules or agent config
      const emergencyContact = escalationRules.emergency_contact || escalationRules.forward_to || null;

      if (!emergencyContact) {
        throw new Error('No emergency contact configured for this agent');
      }

      // Get call log to get call SID
      const callLogResult = await db.query(
        'SELECT provider_call_id FROM call_logs WHERE id = $1',
        [callLogId]
      );

      if (callLogResult.rows.length === 0) {
        throw new Error('Call log not found');
      }

      const callSid = callLogResult.rows[0].provider_call_id;

      if (!callSid) {
        throw new Error('Call SID not found. Call may not be active.');
      }

      // Transfer call using call control service
      const transferResult = await callControlService.transferCall({
        organizationId,
        callSid,
        to: emergencyContact,
        from: conversation.patient_phone
      });

      // Update conversation status
      await db.query(
        'UPDATE conversations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['forwarded', conversationId]
      );

      // Update call log
      await db.query(
        `UPDATE call_logs 
         SET status = 'forwarded', 
             transcription_text = COALESCE(transcription_text || E'\n', '') || $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [`[EMERGENCY FORWARD] Reason: ${reason}. Forwarded to: ${emergencyContact}`, callLogId]
      );

      // Log action
      await db.query(
        'INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4)',
        [
          'CALL_EMERGENCY_FORWARDED',
          'conversations',
          conversationId,
          JSON.stringify({
            reason,
            emergency_contact: emergencyContact,
            agent_id: agentId,
            agent_name: agent.name,
            timestamp: new Date().toISOString()
          })
        ]
      );

      return {
        success: true,
        message: `Call forwarded to emergency contact: ${emergencyContact}`,
        emergency_contact: emergencyContact,
        reason: reason
      };
    } catch (error) {
      console.error('Error forwarding call:', error);
      throw error;
    }
  }

  /**
   * Get emergency forwarding function definition for AI
   */
  getForwardingFunction() {
    return {
      name: 'forward_call',
      description: 'Forward the current call to an emergency contact or supervisor. Use this when the caller has an emergency situation that requires immediate human intervention, or when the AI cannot handle the request.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for forwarding the call (e.g., "Medical emergency", "Complex billing question", "Patient requests human agent")'
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'emergency'],
            description: 'Urgency level of the call'
          }
        },
        required: ['reason']
      }
    };
  }
}

module.exports = new EmergencyForwardingService();

