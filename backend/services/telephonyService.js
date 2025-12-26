const twilio = require('twilio');
const db = require('../config/database');
const aiService = require('./aiService');
const ttsService = require('./ttsService');

class TelephonyService {
  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
    this.baseUrl = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
    
    if (this.twilioAccountSid && this.twilioAuthToken) {
      this.client = twilio(this.twilioAccountSid, this.twilioAuthToken);
    }
  }

  isConfigured() {
    return !!(this.twilioAccountSid && this.twilioAuthToken && this.client);
  }

  /**
   * Initiate an outbound call
   */
  async makeCall({ phoneNumberId, to, agentId, organizationId }) {
    if (!this.isConfigured()) {
      throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }

    try {
      // Get phone number and agent configuration
      const phoneResult = await db.query(
        'SELECT * FROM phone_numbers WHERE id = $1 AND organization_id = $2',
        [phoneNumberId, organizationId]
      );

      if (phoneResult.rows.length === 0) {
        throw new Error('Phone number not found');
      }

      const phoneNumber = phoneResult.rows[0];
      const fromNumber = phoneNumber.phone_number;

      // Get agent configuration
      const agentResult = await db.query(
        'SELECT * FROM ai_agents WHERE id = $1 AND organization_id = $2',
        [agentId, organizationId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('AI agent not found');
      }

      const agent = agentResult.rows[0];

      // Create conversation record
      // Try with organization_id first, fallback if column doesn't exist
      let conversationResult;
      try {
        conversationResult = await db.query(
          `INSERT INTO conversations (organization_id, agent_id, patient_phone, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING *`,
          [organizationId, agentId, to]
        );
      } catch (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message.includes('organization_id')) {
          conversationResult = await db.query(
            `INSERT INTO conversations (agent_id, patient_phone, status)
             VALUES ($1, $2, 'active')
             RETURNING *`,
            [agentId, to]
          );
        } else {
          throw error;
        }
      }

      const conversation = conversationResult.rows[0];

      // Create call log
      const callLogResult = await db.query(
        `INSERT INTO call_logs (
          organization_id, phone_number_id, agent_id, conversation_id,
          caller_phone, direction, status, started_at
        ) VALUES ($1, $2, $3, $4, $5, 'outbound', 'initiated', CURRENT_TIMESTAMP)
        RETURNING *`,
        [organizationId, phoneNumberId, agentId, conversation.id, to]
      );

      const callLog = callLogResult.rows[0];

      // Twilio webhook URL for call handling
      const webhookUrl = `${this.baseUrl}/api/telephony/twilio/voice?conversationId=${conversation.id}&callLogId=${callLog.id}&agentId=${agentId}`;

      // Make the call via Twilio
      const call = await this.client.calls.create({
        to: to,
        from: fromNumber,
        url: webhookUrl,
        method: 'POST',
        record: true, // Enable call recording
        recordingChannels: 'dual', // Record both channels
        recordingStatusCallback: `${this.baseUrl}/api/telephony/twilio/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['in-progress', 'completed'], // Real-time recording updates
        // Enable real-time transcription (Twilio doesn't support real-time, but we can get interim results)
        // Note: For true real-time transcription, use Twilio Media Streams API
        // For now, we'll use post-call transcription with interim updates
        statusCallback: `${this.baseUrl}/api/telephony/twilio/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        // Enable async for faster transcription
        asyncAmd: 'true',
        // Enable real-time transcription
        machineDetection: 'Enable',
        machineDetectionTimeout: 10
      });

      // Update call log with Twilio call SID
      await db.query(
        'UPDATE call_logs SET provider_call_id = $1 WHERE id = $2',
        [call.sid, callLog.id]
      );

      return {
        callSid: call.sid,
        callLogId: callLog.id,
        conversationId: conversation.id,
        status: call.status
      };
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  /**
   * Generate TwiML for voice response
   */
  async generateVoiceResponse({ conversationId, agentId, userInput }) {
    try {
      // Get conversation and agent
      const conversationResult = await db.query(
        'SELECT * FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const conversation = conversationResult.rows[0];

      const agentResult = await db.query(
        'SELECT * FROM ai_agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agentResult.rows[0];

      // Get NLU configuration
      const nluResult = await db.query(
        'SELECT * FROM nlu_configurations WHERE agent_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agentId]
      );

      const nluConfig = nluResult.rows[0] || {};

      // Get conversation history
      const history = conversation.transcript || [];
      
      // Validate AI service is configured
      const provider = nluConfig.provider || agent.voice_model || 'openai';
      const isConfigured = aiService.isConfigured(provider);
      
      if (!isConfigured) {
        throw new Error(`AI service (${provider}) is not configured. Please set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} in environment variables.`);
      }

      // Get AI response
      let aiResponse;
      try {
        aiResponse = await aiService.processConversation({
          agentId: agentId,
          agentConfig: {
            provider: provider,
            model: nluConfig.model || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229'),
            system_prompt: nluConfig.system_prompt || agent.system_prompt,
            temperature: parseFloat(nluConfig.temperature || agent.temperature || 0.7),
            max_tokens: parseInt(nluConfig.max_tokens || agent.max_tokens || 1000),
            type: agent.type
          },
          conversationHistory: history,
          userMessage: userInput || ''
        });
      } catch (aiError) {
        console.error('Error getting AI response:', aiError);
        throw new Error(`Failed to get AI response: ${aiError.message}`);
      }

      if (!aiResponse) {
        throw new Error('AI service returned invalid response');
      }

      // Handle function calls (especially forward_call for emergency)
      if (aiResponse.functionCall && aiResponse.functionCall.name === 'forward_call') {
        const emergencyForwardingService = require('./emergencyForwardingService');
        const args = typeof aiResponse.functionCall.arguments === 'string' 
          ? JSON.parse(aiResponse.functionCall.arguments) 
          : aiResponse.functionCall.arguments;
        
        // Get call log ID
        const callLogResult = await db.query(
          'SELECT id, organization_id FROM call_logs WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
          [conversationId]
        );
        
        if (callLogResult.rows.length > 0) {
          const callLogId = callLogResult.rows[0].id;
          const orgId = callLogResult.rows[0].organization_id;
          
          try {
            const forwardResult = await emergencyForwardingService.forwardCall(
              conversationId,
              callLogId,
              args.reason || 'User requested human agent',
              orgId
            );
            
            // Return TwiML that says we're transferring and then transfers
            const twiml = new twilio.twiml.VoiceResponse();
            twiml.say({
              voice: 'alice',
              language: 'en-US'
            }, 'I understand you need to speak with someone immediately. Please hold while I transfer your call.');
            
            // The actual transfer happens in the forwardCall method via callControlService
            // But we need to return TwiML that continues the call
            return twiml.toString();
          } catch (forwardError) {
            console.error('Error forwarding call:', forwardError);
            // Continue with normal response if forwarding fails
          }
        }
      }

      if (!aiResponse.content) {
        throw new Error('AI service returned invalid response');
      }

      // Update conversation transcript
      const updatedHistory = [...history, {
        role: userInput ? 'user' : 'assistant',
        content: userInput || aiResponse.content,
        timestamp: new Date().toISOString()
      }];

      await db.query(
        'UPDATE conversations SET transcript = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(updatedHistory), conversationId]
      );

      // Get TTS configuration and synthesize speech
      const ttsResult = await db.query(
        'SELECT * FROM tts_configurations WHERE agent_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agentId]
      );

      const ttsConfig = ttsResult.rows[0] || {
        provider: 'elevenlabs',
        voice_id: process.env.ELEVENLABS_VOICE_ID,
        language_code: 'en-US'
      };

      // For Twilio, use <Say> verb for now (can be enhanced with TTS audio URL)
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Enable recording during the call (real-time)
      twiml.record({
        action: `${this.baseUrl}/api/telephony/twilio/recording-status`,
        method: 'POST',
        recordingStatusCallback: `${this.baseUrl}/api/telephony/twilio/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['in-progress', 'completed'],
        transcribe: true,
        transcribeCallback: `${this.baseUrl}/api/telephony/twilio/transcription`,
        transcribeCallbackMethod: 'POST'
      });
      
      // Use <Say> verb for immediate text-to-speech
      // Note: For better quality, you can use <Play> with TTS audio URL
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, aiResponse.content);
      
      // Get call log ID from conversation metadata or query
      const callLogResult = await db.query(
        'SELECT id FROM call_logs WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
        [conversationId]
      );
      const callLogId = callLogResult.rows[0]?.id || '';

      // Gather user speech input with real-time transcription
      twiml.gather({
        input: 'speech',
        action: `${this.baseUrl}/api/telephony/twilio/voice?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
        enhanced: true,
        // Enable real-time transcription during gather
        transcribe: true,
        transcribeCallback: `${this.baseUrl}/api/telephony/twilio/transcription`
      });

      return twiml.toString();
    } catch (error) {
      console.error('Error generating voice response:', error);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, 'I apologize, but I encountered an error. Please try again later.');
      twiml.hangup();
      return twiml.toString();
    }
  }

  /**
   * Check consent for call recording
   */
  async checkConsent(phoneNumber, organizationId, consentType = 'recording') {
    try {
      const result = await db.query(
        `SELECT * FROM consent_records 
         WHERE phone_number = $1 
           AND organization_id = $2 
           AND consent_type = $3 
           AND consent_status = 'granted'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY created_at DESC 
         LIMIT 1`,
        [phoneNumber, organizationId, consentType]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Record consent for call recording
   */
  async recordConsent({ phoneNumber, organizationId, consentType, consentMethod, metadata }) {
    try {
      const result = await db.query(
        `INSERT INTO consent_records (
          organization_id, phone_number, consent_type, consent_method,
          consent_status, consent_text, metadata
        ) VALUES ($1, $2, $3, $4, 'granted', $5, $6)
        RETURNING *`,
        [
          organizationId,
          phoneNumber,
          consentType,
          consentMethod || 'verbal',
          'Call recording consent granted via IVR',
          JSON.stringify(metadata || {})
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Update call log when call ends
   */
  async updateCallLog(callSid, updates) {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = [callSid, ...Object.values(updates)];

      await db.query(
        `UPDATE call_logs 
         SET ${setClause}, updated_at = CURRENT_TIMESTAMP
         WHERE provider_call_id = $1`,
        values
      );
    } catch (error) {
      console.error('Error updating call log:', error);
      throw error;
    }
  }

  /**
   * Save call recording information
   */
  async saveRecording({ callLogId, recordingUrl, organizationId, duration, format = 'mp3' }) {
    try {
      const result = await db.query(
        `INSERT INTO call_recordings (
          call_log_id, organization_id, recording_url,
          duration_seconds, format, storage_provider
        ) VALUES ($1, $2, $3, $4, $5, 'twilio')
        RETURNING *`,
        [callLogId, organizationId, recordingUrl, duration, format]
      );

      // Update call_logs with recording URL
      await db.query(
        'UPDATE call_logs SET recording_url = $1 WHERE id = $2',
        [recordingUrl, callLogId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error saving recording:', error);
      throw error;
    }
  }

  /**
   * Get medical vocabulary hints for speech recognition
   */
  getMedicalVocabularyHints(agentType) {
    const baseHints = ['appointment', 'doctor', 'medical', 'health', 'patient', 'symptom', 'medication'];
    
    const typeSpecificHints = {
      'front_desk': ['schedule', 'reschedule', 'cancel', 'insurance', 'hours', 'location'],
      'medical_assistant': ['prescription', 'refill', 'lab results', 'test', 'visit'],
      'triage_nurse': ['emergency', 'urgent', 'pain', 'chest pain', 'shortness of breath', 'fever'],
      'billing_specialist': ['payment', 'bill', 'statement', 'insurance', 'coverage', 'copay'],
      'collections_specialist': ['balance', 'overdue', 'payment plan', 'installment']
    };

    return [...baseHints, ...(typeSpecificHints[agentType] || [])];
  }
}

module.exports = new TelephonyService();

