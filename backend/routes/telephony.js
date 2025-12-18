const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const telephonyService = require('../services/telephonyService');
const router = express.Router();

// Get all phone numbers for organization
router.get('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ phone_numbers: result.rows });
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({ message: 'Error fetching phone numbers' });
  }
});

// Add phone number
router.post('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { phone_number, provider, provider_sid, capabilities, monthly_cost } = req.body;

    const result = await db.query(
      `INSERT INTO phone_numbers (organization_id, phone_number, provider, provider_sid, capabilities, monthly_cost)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, phone_number, provider, provider_sid, JSON.stringify(capabilities || {}), monthly_cost]
    );

    res.status(201).json({ phone_number: result.rows[0] });
  } catch (error) {
    console.error('Error creating phone number:', error);
    res.status(500).json({ message: 'Error creating phone number' });
  }
});

// Get call logs
router.get('/calls', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, agent_id, status, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    let query = `
      SELECT cl.*, aa.name as agent_name, aa.type as agent_type, pn.phone_number
      FROM call_logs cl
      LEFT JOIN ai_agents aa ON cl.agent_id = aa.id
      LEFT JOIN phone_numbers pn ON cl.phone_number_id = pn.id
      WHERE cl.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (agent_id) {
      paramCount++;
      query += ` AND cl.agent_id = $${paramCount}`;
      params.push(agent_id);
    }

    if (status) {
      paramCount++;
      query += ` AND cl.status = $${paramCount}`;
      params.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND cl.started_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND cl.started_at <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY cl.started_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM call_logs WHERE organization_id = $1',
      [orgId]
    );

    res.json({
      calls: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ message: 'Error fetching call logs' });
  }
});

// Create call log entry
router.post('/calls', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const {
      phone_number_id,
      agent_id,
      conversation_id,
      caller_phone,
      caller_name,
      direction,
      status,
      duration_seconds,
      recording_url,
      transcription_text,
      cost,
      provider_call_id,
      started_at,
      ended_at
    } = req.body;

    const result = await db.query(
      `INSERT INTO call_logs (
        organization_id, phone_number_id, agent_id, conversation_id,
        caller_phone, caller_name, direction, status, duration_seconds,
        recording_url, transcription_text, cost, provider_call_id,
        started_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        orgId, phone_number_id, agent_id, conversation_id,
        caller_phone, caller_name, direction, status, duration_seconds,
        recording_url, transcription_text, cost, provider_call_id,
        started_at, ended_at
      ]
    );

    res.status(201).json({ call: result.rows[0] });
  } catch (error) {
    console.error('Error creating call log:', error);
    res.status(500).json({ message: 'Error creating call log' });
  }
});

// Make outbound call
router.post('/calls/make', authenticateToken, async (req, res) => {
  try {
    if (!telephonyService.isConfigured()) {
      return res.status(400).json({ 
        message: 'Telephony service is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN' 
      });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const { phone_number_id, to, agent_id } = req.body;

    if (!phone_number_id || !to || !agent_id) {
      return res.status(400).json({ 
        message: 'phone_number_id, to, and agent_id are required' 
      });
    }

    const result = await telephonyService.makeCall({
      phoneNumberId: phone_number_id,
      to: to,
      agentId: agent_id,
      organizationId: orgId
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ message: error.message || 'Error making call' });
  }
});

// Twilio webhook - Handle incoming/outgoing call voice
router.post('/twilio/voice', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { conversationId, callLogId, agentId } = req.query;
    const { SpeechResult, From, CallSid } = req.body;

    // Get organization from call log
    const callLogResult = await db.query(
      'SELECT organization_id FROM call_logs WHERE id = $1',
      [callLogId]
    );

    if (callLogResult.rows.length === 0) {
      return res.status(404).send('<Response><Say>Error: Call log not found</Say></Response>');
    }

    const organizationId = callLogResult.rows[0].organization_id;

    // Check if this is the initial call (no speech result yet)
    if (!SpeechResult && conversationId) {
      // Generate initial greeting
      const twiml = await telephonyService.generateVoiceResponse({
        conversationId: conversationId,
        agentId: agentId,
        userInput: null
      });

      // Check consent for recording
      const hasConsent = await telephonyService.checkConsent(From, organizationId, 'recording');
      
      if (!hasConsent) {
        // Request consent
        const twilio = require('twilio');
        const response = new twilio.twiml.VoiceResponse();
        response.say('This call may be recorded for quality and compliance purposes. Do you consent to recording?');
        response.gather({
          input: 'speech',
          action: `${telephonyService.baseUrl}/api/telephony/twilio/consent?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}&from=${From}`,
          method: 'POST',
          speechTimeout: 'auto'
        });
        return res.send(response.toString());
      }

      return res.send(twiml);
    }

    // Process user speech input
    if (SpeechResult && conversationId) {
      const twiml = await telephonyService.generateVoiceResponse({
        conversationId: conversationId,
        agentId: agentId,
        userInput: SpeechResult
      });

      return res.send(twiml);
    }

    // Fallback
    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    response.say('I apologize, but I encountered an error. Goodbye.');
    response.hangup();
    return res.send(response.toString());
  } catch (error) {
    console.error('Error handling Twilio voice webhook:', error);
    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    response.say('I apologize, but I encountered an error. Please try again later.');
    response.hangup();
    return res.send(response.toString());
  }
});

// Twilio webhook - Handle consent response
router.post('/twilio/consent', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { conversationId, callLogId, agentId, from } = req.query;
    const { SpeechResult } = req.body;

    const callLogResult = await db.query(
      'SELECT organization_id FROM call_logs WHERE id = $1',
      [callLogId]
    );

    const organizationId = callLogResult.rows[0].organization_id;

    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();

    // Check if user consented
    const consentGiven = SpeechResult && (
      SpeechResult.toLowerCase().includes('yes') || 
      SpeechResult.toLowerCase().includes('agree') ||
      SpeechResult.toLowerCase().includes('consent') ||
      SpeechResult.toLowerCase().includes('okay')
    );

    if (consentGiven) {
      await telephonyService.recordConsent({
        phoneNumber: from,
        organizationId: organizationId,
        consentType: 'recording',
        consentMethod: 'verbal',
        metadata: { callLogId, conversationId }
      });

      // Continue with the call
      const twiml = await telephonyService.generateVoiceResponse({
        conversationId: conversationId,
        agentId: agentId,
        userInput: null
      });
      return res.send(twiml);
    } else {
      response.say('Recording consent is required to continue. The call will now end.');
      response.hangup();
      return res.send(response.toString());
    }
  } catch (error) {
    console.error('Error handling consent:', error);
    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    response.say('Error processing consent. Goodbye.');
    response.hangup();
    return res.send(response.toString());
  }
});

// Twilio webhook - Handle call status updates
router.post('/twilio/status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, To, From } = req.body;

    const updates = {
      status: CallStatus === 'completed' ? 'completed' : CallStatus
    };

    if (CallDuration) {
      updates.duration_seconds = parseInt(CallDuration);
      updates.ended_at = new Date();
    }

    await telephonyService.updateCallLog(CallSid, updates);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// Twilio webhook - Handle recording status
router.post('/twilio/recording-status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration, RecordingStatus } = req.body;

    if (RecordingStatus === 'completed' && RecordingUrl) {
      // Get call log
      const callLogResult = await db.query(
        'SELECT id, organization_id FROM call_logs WHERE provider_call_id = $1',
        [CallSid]
      );

      if (callLogResult.rows.length > 0) {
        const callLog = callLogResult.rows[0];
        
        await telephonyService.saveRecording({
          callLogId: callLog.id,
          recordingUrl: RecordingUrl,
          organizationId: callLog.organization_id,
          duration: parseInt(RecordingDuration || 0),
          format: 'mp3'
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// Twilio webhook - Handle transcription
router.post('/twilio/transcription', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, TranscriptionText, TranscriptionStatus, TranscriptionUrl } = req.body;

    if (TranscriptionStatus === 'completed' && TranscriptionText) {
      // Get call log
      const callLogResult = await db.query(
        'SELECT id, organization_id FROM call_logs WHERE provider_call_id = $1',
        [CallSid]
      );

      if (callLogResult.rows.length > 0) {
        const callLog = callLogResult.rows[0];
        
        // Update call log with transcription
        await db.query(
          'UPDATE call_logs SET transcription_text = $1 WHERE id = $2',
          [TranscriptionText, callLog.id]
        );

        // Log transcription completion
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            1,
            'CALL_TRANSCRIBED',
            'call_logs',
            callLog.id,
            JSON.stringify({ transcription_url: TranscriptionUrl, status: TranscriptionStatus })
          ]
        );
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling transcription:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// TTS audio endpoint for Twilio
router.get('/tts-audio', async (req, res) => {
  try {
    const { text, agentId } = req.query;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // Get TTS configuration
    let ttsConfig = null;
    if (agentId) {
      const configResult = await db.query(
        'SELECT * FROM tts_configurations WHERE agent_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agentId]
      );
      if (configResult.rows.length > 0) {
        ttsConfig = configResult.rows[0];
      }
    }

    const ttsService = require('../services/ttsService');
    const result = await ttsService.synthesize(text, ttsConfig || {
      provider: 'elevenlabs',
      voice_id: process.env.ELEVENLABS_VOICE_ID,
      language_code: 'en-US'
    });

    // Return audio file
    const audioBuffer = Buffer.from(result.audio, 'base64');
    res.setHeader('Content-Type', `audio/${result.format || 'mp3'}`);
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error generating TTS audio:', error);
    res.status(500).json({ message: 'Error generating audio' });
  }
});

module.exports = router;

