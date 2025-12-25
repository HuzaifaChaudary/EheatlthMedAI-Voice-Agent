const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const telephonyService = require('../services/telephonyService');
const smsService = require('../services/smsService');
const callControlService = require('../services/callControlService');
const voicemailService = require('../services/voicemailService');
const router = express.Router();

// Test endpoint to verify routing works
router.get('/test-search', (req, res) => {
  res.json({ message: 'Test search endpoint works!' });
});

// Search available phone numbers from Twilio
// IMPORTANT: This route must come BEFORE /phone-numbers to avoid route conflicts
router.get('/phone-numbers/search', authenticateToken, async (req, res) => {
  console.log('🔍 Phone number search endpoint hit!');
  console.log('  Query params:', req.query);
  console.log('  User:', req.user?.id);
  console.log('  Path:', req.path);
  console.log('  Original URL:', req.originalUrl);
  try {
    const { area_code, country_code = 'US', limit = 20 } = req.query;

    if (!area_code) {
      console.log('❌ Missing area_code');
      return res.status(400).json({ message: 'Area code is required' });
    }

    // Get Twilio client
    const twilio = require('twilio');
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

    if (!accountSid || !authToken) {
      return res.status(500).json({ message: 'Twilio is not configured' });
    }

    const client = twilio(accountSid, authToken);

    // Search available phone numbers
    const availableNumbers = await client.availablePhoneNumbers(country_code)
      .local
      .list({
        areaCode: parseInt(area_code),
        limit: parseInt(limit)
      });

    const numbers = availableNumbers.map(num => ({
      phone_number: num.phoneNumber,
      friendly_name: num.friendlyName,
      locality: num.locality,
      region: num.region,
      postal_code: num.postalCode,
      capabilities: {
        voice: num.capabilities.voice,
        sms: num.capabilities.SMS,
        mms: num.capabilities.MMS
      },
      monthly_cost: num.capabilities.voice ? 1.00 : 0.00 // Default cost
    }));

    res.json({ available_numbers: numbers });
  } catch (error) {
    console.error('Error searching phone numbers:', error);
    res.status(500).json({ message: 'Error searching phone numbers', error: error.message });
  }
});

// Get all phone numbers for organization
// IMPORTANT: This route must come AFTER /phone-numbers/search to avoid route conflicts
router.get('/phone-numbers', authenticateToken, async (req, res) => {
  console.log('📞 Phone numbers list endpoint hit (NOT search)');
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (orgResult.rows.length === 0) {
      return res.json({ phone_numbers: [] }); // Return empty array instead of 404
    }

    const orgId = orgResult.rows[0]?.organization_id || null;

    // Handle both cases: with organization_id and without (null)
    let result;
    if (orgId) {
      result = await db.query(
        'SELECT * FROM phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else {
      // If user has no organization_id, show all phone numbers with null organization_id
      result = await db.query(
        'SELECT * FROM phone_numbers WHERE organization_id IS NULL ORDER BY created_at DESC'
      );
    }

    res.json({ phone_numbers: result.rows });
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({ message: 'Error fetching phone numbers', error: error.message });
  }
});

// Purchase phone number from Twilio
router.post('/phone-numbers/purchase', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { phone_number, capabilities } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;

    // Get Twilio client
    const twilio = require('twilio');
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

    if (!accountSid || !authToken) {
      return res.status(500).json({ message: 'Twilio is not configured' });
    }

    const client = twilio(accountSid, authToken);

    // Purchase the phone number from Twilio
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phone_number,
      voiceUrl: `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/telephony/twilio/inbound`,
      smsUrl: `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/telephony/twilio/sms`,
      statusCallback: `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/telephony/twilio/status`,
      statusCallbackMethod: 'POST'
    });

    // Save to database
    const result = await db.query(
      `INSERT INTO phone_numbers (organization_id, phone_number, provider, provider_sid, capabilities, monthly_cost, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        orgId,
        purchasedNumber.phoneNumber,
        'twilio',
        purchasedNumber.sid,
        JSON.stringify(capabilities || purchasedNumber.capabilities || { voice: true, sms: true }),
        1.00, // Default monthly cost
        true
      ]
    );

    res.status(201).json({ 
      phone_number: result.rows[0],
      twilio_sid: purchasedNumber.sid,
      message: 'Phone number purchased and added successfully'
    });
  } catch (error) {
    console.error('Error purchasing phone number:', error);
    res.status(500).json({ message: 'Error purchasing phone number', error: error.message });
  }
});

// Add phone number (Bring Your Own Number - BYON)
router.post('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;

    const { phone_number, provider, provider_sid, capabilities, monthly_cost } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const result = await db.query(
      `INSERT INTO phone_numbers (organization_id, phone_number, provider, provider_sid, capabilities, monthly_cost, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, phone_number, provider || 'twilio', provider_sid, JSON.stringify(capabilities || { voice: true, sms: true }), monthly_cost || null, true]
    );

    res.status(201).json({ 
      phone_number: result.rows[0],
      message: 'Phone number added successfully'
    });
  } catch (error) {
    console.error('Error creating phone number:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'This phone number already exists' });
    }
    res.status(500).json({ message: 'Error creating phone number', error: error.message });
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

    const orgId = orgResult.rows[0]?.organization_id || null;

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

    const orgId = orgResult.rows[0]?.organization_id || null;

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

    const orgId = orgResult.rows[0]?.organization_id || null;

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

// Twilio webhook - Handle incoming call
router.post('/twilio/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { From, To, CallSid } = req.body;

    // Find phone number and organization
    const phoneResult = await db.query(
      'SELECT * FROM phone_numbers WHERE phone_number = $1',
      [To]
    );

    if (phoneResult.rows.length === 0) {
      const twilio = require('twilio');
      const response = new twilio.twiml.VoiceResponse();
      response.say('Sorry, this number is not configured. Goodbye.');
      response.hangup();
      return res.send(response.toString());
    }

    const phoneNumber = phoneResult.rows[0];
    const organizationId = phoneNumber.organization_id;

    // Get default agent for this phone number
    const agentResult = await db.query(
      'SELECT * FROM ai_agents WHERE phone_number_id = $1 AND organization_id = $2 AND is_active = true LIMIT 1',
      [phoneNumber.id, organizationId]
    );

    if (agentResult.rows.length === 0) {
      const twilio = require('twilio');
      const response = new twilio.twiml.VoiceResponse();
      response.say('Sorry, no agent is configured for this number. Goodbye.');
      response.hangup();
      return res.send(response.toString());
    }

    const agent = agentResult.rows[0];

    // Create conversation
    const conversationResult = await db.query(
      `INSERT INTO conversations (organization_id, agent_id, patient_phone, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [organizationId, agent.id, From]
    );

    const conversation = conversationResult.rows[0];

    // Create call log
    const callLogResult = await db.query(
      `INSERT INTO call_logs (
        organization_id, phone_number_id, agent_id, conversation_id,
        caller_phone, direction, status, provider_call_id, started_at
      ) VALUES ($1, $2, $3, $4, $5, 'inbound', 'ringing', $6, CURRENT_TIMESTAMP)
      RETURNING *`,
      [organizationId, phoneNumber.id, agent.id, conversation.id, From, CallSid]
    );

    const callLog = callLogResult.rows[0];

    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    
    // Check consent for recording
    const hasConsent = await telephonyService.checkConsent(From, organizationId, 'recording');
    
    if (!hasConsent) {
      response.say('This call may be recorded for quality and compliance purposes. Do you consent to recording?');
      response.gather({
        input: 'speech',
        action: `${telephonyService.baseUrl}/api/telephony/twilio/consent?conversationId=${conversation.id}&callLogId=${callLog.id}&agentId=${agent.id}&from=${From}`,
        method: 'POST',
        speechTimeout: 'auto'
      });
      return res.send(response.toString());
    }

    // Generate initial greeting
    const twiml = await telephonyService.generateVoiceResponse({
      conversationId: conversation.id,
      agentId: agent.id,
      userInput: null
    });

    return res.send(twiml);
  } catch (error) {
    console.error('Error handling inbound call:', error);
    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    response.say('I apologize, but I encountered an error. Please try again later.');
    response.hangup();
    return res.send(response.toString());
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

// Twilio webhook - Handle transcription (real-time and final)
router.post('/twilio/transcription', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { 
      CallSid, 
      TranscriptionText, 
      TranscriptionStatus, 
      TranscriptionUrl,
      TranscriptionSid,
      Confidence
    } = req.body;

    // Get call log
    const callLogResult = await db.query(
      'SELECT id, organization_id, started_at FROM call_logs WHERE provider_call_id = $1',
      [CallSid]
    );

    if (callLogResult.rows.length > 0) {
      const callLog = callLogResult.rows[0];
      
      // Calculate timestamp in call (seconds from start)
      const timestampSeconds = callLog.started_at 
        ? Math.floor((new Date() - new Date(callLog.started_at)) / 1000)
        : 0;

      // Save real-time transcription (interim or final)
      const isFinal = TranscriptionStatus === 'completed';
      
      if (TranscriptionText) {
        await db.query(
          `INSERT INTO call_transcriptions (
            call_log_id, organization_id, transcription_text,
            confidence, is_final, timestamp_seconds
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            callLog.id,
            callLog.organization_id,
            TranscriptionText,
            Confidence ? parseFloat(Confidence) : null,
            isFinal,
            timestampSeconds
          ]
        );
      }

      // Update call log with final transcription
      if (isFinal && TranscriptionText) {
        await db.query(
          'UPDATE call_logs SET transcription_text = $1 WHERE id = $2',
          [TranscriptionText, callLog.id]
        );

        // Log transcription completion
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES (NULL, 'CALL_TRANSCRIBED', 'call_logs', $1, $2)`,
          [
            callLog.id,
            JSON.stringify({ 
              transcription_url: TranscriptionUrl, 
              transcription_sid: TranscriptionSid,
              status: TranscriptionStatus,
              confidence: Confidence,
              timestamp: new Date().toISOString()
            })
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

// SMS Routes
// Send SMS
router.post('/sms/send', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { to, from, message, conversation_id } = req.body;

    if (!to || !message) {
      return res.status(400).json({ message: 'to and message are required' });
    }

    const result = await smsService.sendSMS({
      organizationId: orgId,
      to,
      from,
      message,
      conversationId: conversation_id
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ message: error.message || 'Error sending SMS' });
  }
});

// Get SMS messages
router.get('/sms', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { conversation_id, direction, start_date, end_date, page = 1, limit = 50 } = req.query;

    const messages = await smsService.getSMSMessages(orgId, {
      conversationId: conversation_id,
      direction,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching SMS messages:', error);
    res.status(500).json({ message: 'Error fetching SMS messages' });
  }
});

// Twilio webhook - Handle incoming SMS
router.post('/twilio/sms', express.urlencoded({ extended: true }), async (req, res) => {
  await smsService.handleIncomingSMS(req, res);
});

// Call Control Routes
// Transfer call
router.post('/calls/:callSid/transfer', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { callSid } = req.params;
    const { to, from } = req.body;

    if (!to) {
      return res.status(400).json({ message: 'to is required' });
    }

    const result = await callControlService.transferCall({
      organizationId: orgId,
      callSid,
      to,
      from
    });

    res.json(result);
  } catch (error) {
    console.error('Error transferring call:', error);
    res.status(500).json({ message: error.message || 'Error transferring call' });
  }
});

// Hold call
router.post('/calls/:callSid/hold', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { callSid } = req.params;
    const { hold_music } = req.body;

    const result = await callControlService.holdCall({
      organizationId: orgId,
      callSid,
      holdMusic: hold_music
    });

    res.json(result);
  } catch (error) {
    console.error('Error holding call:', error);
    res.status(500).json({ message: error.message || 'Error holding call' });
  }
});

// Mute/unmute call
router.post('/calls/:callSid/mute', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { callSid } = req.params;
    const { mute = true } = req.body;

    const result = await callControlService.muteCall({
      organizationId: orgId,
      callSid,
      mute
    });

    res.json(result);
  } catch (error) {
    console.error('Error muting call:', error);
    res.status(500).json({ message: error.message || 'Error muting call' });
  }
});

// Hang up call
router.post('/calls/:callSid/hangup', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { callSid } = req.params;

    const result = await callControlService.hangupCall({
      organizationId: orgId,
      callSid
    });

    res.json(result);
  } catch (error) {
    console.error('Error hanging up call:', error);
    res.status(500).json({ message: error.message || 'Error hanging up call' });
  }
});

// Get call status
router.get('/calls/:callSid/status', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { callSid } = req.params;

    const result = await callControlService.getCallStatus({
      organizationId: orgId,
      callSid
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting call status:', error);
    res.status(500).json({ message: error.message || 'Error getting call status' });
  }
});

// Call Recordings Routes
// Get call recordings
router.get('/recordings', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { call_log_id, start_date, end_date, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        cr.*,
        cl.caller_phone,
        cl.direction,
        cl.status as call_status,
        a.name as agent_name,
        a.type as agent_type
      FROM call_recordings cr
      JOIN call_logs cl ON cr.call_log_id = cl.id
      LEFT JOIN ai_agents a ON cl.agent_id = a.id
      WHERE cl.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;

    if (call_log_id) {
      paramCount++;
      query += ` AND cr.call_log_id = $${paramCount}`;
      params.push(call_log_id);
    }

    if (start_date) {
      paramCount++;
      query += ` AND cr.created_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND cr.created_at <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY cr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await db.query(query, params);
    res.json({ recordings: result.rows });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ message: 'Error fetching recordings' });
  }
});

// Voicemail Routes
// Get voicemails
router.get('/voicemails', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { status, start_date, end_date, page = 1, limit = 50 } = req.query;

    const voicemails = await voicemailService.getVoicemails(orgId, {
      status,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ voicemails });
  } catch (error) {
    console.error('Error fetching voicemails:', error);
    res.status(500).json({ message: 'Error fetching voicemails' });
  }
});

// Mark voicemail as read
router.patch('/voicemails/:id/read', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { id } = req.params;

    const result = await voicemailService.markVoicemailAsRead(id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error marking voicemail as read:', error);
    res.status(500).json({ message: error.message || 'Error marking voicemail as read' });
  }
});

// Delete voicemail
router.delete('/voicemails/:id', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { id } = req.params;

    const result = await voicemailService.deleteVoicemail(id, orgId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting voicemail:', error);
    res.status(500).json({ message: error.message || 'Error deleting voicemail' });
  }
});

// Twilio webhook - Handle voicemail recording
router.post('/twilio/voicemail', express.urlencoded({ extended: true }), async (req, res) => {
  await voicemailService.handleVoicemailRecording(req, res);
});

// Twilio webhook - Handle transfer status
router.post('/twilio/transfer-status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallStatus, CallSid } = req.body;
    
    // Log transfer status
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES (NULL, 'CALL_TRANSFER_STATUS', 'call_logs', 
       (SELECT id FROM call_logs WHERE provider_call_id = $1), $2)`,
      [CallSid, JSON.stringify({ status: CallStatus, timestamp: new Date().toISOString() })]
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling transfer status:', error);
    res.status(200).send('OK');
  }
});

module.exports = router;

