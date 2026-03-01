const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const ttsService = require('../services/ttsService');
const router = express.Router();

// ============================================================
// Default system prompts for each agent type
// These are shown in the prompt editor on the main page
// ============================================================
const defaultAgentPrompts = {
  'front_desk': `You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately.

Key responsibilities:
- Schedule, reschedule, and cancel appointments
- Answer questions about office hours, location, and services
- Route urgent matters to appropriate staff
- Collect basic patient information when needed

Be warm, professional, and efficient. Keep responses concise since this is a voice conversation.`,

  'medical_assistant': `You are a medical assistant AI for a healthcare practice. Help patients with medication-related requests, lab results inquiries, pre-visit intake, and preparation instructions.

Key responsibilities:
- Process medication refill requests
- Explain lab test results in patient-friendly language
- Collect pre-visit intake information
- Provide preparation instructions for upcoming procedures

Always remind patients to consult with their healthcare provider for medical advice. Keep responses concise for voice conversation.`,

  'triage_nurse': `You are a triage nurse AI assistant. Assess patient symptoms, determine urgency levels, and follow protocol-driven pathways to provide appropriate care guidance.

Key responsibilities:
- Conduct structured symptom assessments
- Determine urgency levels (emergent, urgent, semi-urgent, routine)
- Identify red flags requiring immediate emergency care
- Guide patients to appropriate level of care

CRITICAL: For chest pain, difficulty breathing, stroke symptoms, severe bleeding, or unconsciousness — immediately direct patients to call 911. Keep responses concise for voice conversation.`
};

// ============================================================
// PUBLIC ENDPOINTS (no authentication required)
// These power the main page voice agent feature
// ============================================================

// Get public agents list for the main page
router.get('/agents/public', async (req, res) => {
  try {
    // Try to get agents from database first
    const result = await db.query(
      'SELECT id, name, type, description, greeting_message FROM ai_agents WHERE is_active = true ORDER BY name'
    );

    if (result.rows.length > 0) {
      return res.json({
        agents: result.rows.map(agent => {
          const normalizedType = agent.type?.toLowerCase().replace(/\s+/g, '_') || '';
          return {
            id: agent.id,
            name: agent.name,
            type: normalizedType,
            description: agent.description,
            greeting_message: agent.greeting_message || 'Hello! How can I help you today?',
            default_prompt: defaultAgentPrompts[normalizedType] || defaultAgentPrompts['front_desk']
          };
        })
      });
    }

    // Return default agent types if no agents in DB
    res.json({
      agents: [
        {
          id: null,
          name: 'Front Desk',
          type: 'front_desk',
          description: 'Handles appointment scheduling, general inquiries, and call routing',
          greeting_message: 'Hello! Welcome to our practice. How can I help you today?',
          default_prompt: defaultAgentPrompts['front_desk']
        },
        {
          id: null,
          name: 'Medical Assistant',
          type: 'medical_assistant',
          description: 'Helps with medication refills, lab results, and pre-visit intake',
          greeting_message: 'Hello! I\'m here to help with your medical needs.',
          default_prompt: defaultAgentPrompts['medical_assistant']
        },
        {
          id: null,
          name: 'Triage Nurse Assistant',
          type: 'triage_nurse',
          description: 'Assesses symptoms, determines urgency, and provides care guidance',
          greeting_message: 'Hello! I\'m here to help assess your symptoms and guide you to the right care.',
          default_prompt: defaultAgentPrompts['triage_nurse']
        }
      ]
    });
  } catch (error) {
    console.error('Error fetching public agents:', error);
    // Return defaults on error so the page always works
    res.json({
      agents: [
        { id: null, name: 'Front Desk', type: 'front_desk', description: 'Handles appointment scheduling, general inquiries, and call routing', default_prompt: defaultAgentPrompts['front_desk'] },
        { id: null, name: 'Medical Assistant', type: 'medical_assistant', description: 'Helps with medication refills, lab results, and pre-visit intake', default_prompt: defaultAgentPrompts['medical_assistant'] },
        { id: null, name: 'Triage Nurse Assistant', type: 'triage_nurse', description: 'Assesses symptoms, determines urgency, and provides care guidance', default_prompt: defaultAgentPrompts['triage_nurse'] }
      ]
    });
  }
});

// Create voice session — generates an OpenAI Realtime API ephemeral token
// This keeps the real API key on the server while allowing the browser
// to establish a direct WebRTC connection to OpenAI for minimum latency
router.post('/session', async (req, res) => {
  try {
    const { agentType, systemPrompt, voice = 'coral' } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OpenAI API key not configured. Please set OPENAI_API_KEY in the backend .env file.'
      });
    }

    // Build the system prompt — use custom prompt if provided, otherwise default
    const normalizedType = agentType?.toLowerCase().replace(/\s+/g, '_') || 'front_desk';
    const instructions = systemPrompt || defaultAgentPrompts[normalizedType] || defaultAgentPrompts['front_desk'];

    // Create an ephemeral token via OpenAI Realtime Sessions API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        voice: voice,
        instructions: instructions,
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI Realtime session creation failed:', response.status, errorData);
      return res.status(502).json({
        message: 'Failed to create voice session with OpenAI',
        error: errorData.error?.message || `HTTP ${response.status}`
      });
    }

    const data = await response.json();

    console.log('✅ Voice session created:', {
      sessionId: data.id,
      model: data.model,
      voice: voice,
      agentType: normalizedType
    });

    res.json({
      ephemeralToken: data.client_secret?.value,
      sessionId: data.id,
      model: data.model,
      voice: voice,
      expiresAt: data.client_secret?.expires_at
    });
  } catch (error) {
    console.error('Error creating voice session:', error);
    res.status(500).json({
      message: 'Error creating voice session',
      error: error.message
    });
  }
});

// ============================================================
// AUTHENTICATED ENDPOINTS (existing routes below)
// ============================================================

// Get STT configurations for an agent
router.get('/stt/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM stt_configurations WHERE agent_id = $1 AND organization_id = $2',
      [agentId, orgId]
    );

    res.json({ configurations: result.rows });
  } catch (error) {
    console.error('Error fetching STT configs:', error);
    res.status(500).json({ message: 'Error fetching STT configurations' });
  }
});

// Create/Update STT configuration
router.post('/stt', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { agent_id, provider, model, language_code, sample_rate, encoding, config } = req.body;

    const result = await db.query(
      `INSERT INTO stt_configurations (organization_id, agent_id, provider, model, language_code, sample_rate, encoding, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         model = EXCLUDED.model,
         language_code = EXCLUDED.language_code,
         sample_rate = EXCLUDED.sample_rate,
         encoding = EXCLUDED.encoding,
         config = EXCLUDED.config,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orgId, agent_id, provider, model, language_code, sample_rate, encoding, JSON.stringify(config || {})]
    );

    res.status(201).json({ configuration: result.rows[0] });
  } catch (error) {
    console.error('Error creating STT config:', error);
    res.status(500).json({ message: 'Error creating STT configuration' });
  }
});

// Get NLU configurations
router.get('/nlu/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM nlu_configurations WHERE agent_id = $1 AND organization_id = $2',
      [agentId, orgId]
    );

    res.json({ configurations: result.rows });
  } catch (error) {
    console.error('Error fetching NLU configs:', error);
    res.status(500).json({ message: 'Error fetching NLU configurations' });
  }
});

// Create/Update NLU configuration
router.post('/nlu', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { agent_id, provider, model, temperature, max_tokens, system_prompt, functions, config } = req.body;

    const result = await db.query(
      `INSERT INTO nlu_configurations (organization_id, agent_id, provider, model, temperature, max_tokens, system_prompt, functions, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         model = EXCLUDED.model,
         temperature = EXCLUDED.temperature,
         max_tokens = EXCLUDED.max_tokens,
         system_prompt = EXCLUDED.system_prompt,
         functions = EXCLUDED.functions,
         config = EXCLUDED.config,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orgId, agent_id, provider, model, temperature, max_tokens, system_prompt, JSON.stringify(functions || []), JSON.stringify(config || {})]
    );

    res.status(201).json({ configuration: result.rows[0] });
  } catch (error) {
    console.error('Error creating NLU config:', error);
    res.status(500).json({ message: 'Error creating NLU configuration' });
  }
});

// Get TTS configurations
router.get('/tts/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const result = await db.query(
      'SELECT * FROM tts_configurations WHERE agent_id = $1 AND organization_id = $2',
      [agentId, orgId]
    );

    res.json({ configurations: result.rows });
  } catch (error) {
    console.error('Error fetching TTS configs:', error);
    res.status(500).json({ message: 'Error fetching TTS configurations' });
  }
});

// Create/Update TTS configuration
router.post('/tts', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    const { agent_id, provider, voice_id, voice_name, language_code, speaking_rate, pitch, volume_gain_db, config } = req.body;

    if (!agent_id) {
      return res.status(400).json({ message: 'agent_id is required' });
    }

    if (!provider) {
      return res.status(400).json({ message: 'provider is required' });
    }

    // Validate numeric ranges
    if (speaking_rate !== undefined && (speaking_rate < 0.25 || speaking_rate > 4.0)) {
      return res.status(400).json({ message: 'speaking_rate must be between 0.25 and 4.0' });
    }
    if (pitch !== undefined && (pitch < -20 || pitch > 20)) {
      return res.status(400).json({ message: 'pitch must be between -20 and 20' });
    }
    if (volume_gain_db !== undefined && (volume_gain_db < -96 || volume_gain_db > 16)) {
      return res.status(400).json({ message: 'volume_gain_db must be between -96 and 16' });
    }

    // Check if TTS config already exists for this agent
    let existingResult;
    if (orgId) {
      existingResult = await db.query(
        'SELECT id FROM tts_configurations WHERE agent_id = $1 AND organization_id = $2',
        [agent_id, orgId]
      );
    } else {
      // Fallback: check by agent_id only if organization_id is null
      existingResult = await db.query(
        'SELECT id FROM tts_configurations WHERE agent_id = $1 AND organization_id IS NULL',
        [agent_id]
      );
    }

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing configuration
      if (orgId) {
        result = await db.query(
          `UPDATE tts_configurations 
           SET provider = $1,
               voice_id = $2,
               voice_name = $3,
               language_code = $4,
               speaking_rate = $5,
               pitch = $6,
               volume_gain_db = $7,
               config = $8,
               updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = $9 AND organization_id = $10
           RETURNING *`,
          [
            provider,
            voice_id || null,
            voice_name || null,
            language_code || 'en-US',
            speaking_rate || 1.0,
            pitch || 0.0,
            volume_gain_db || 0.0,
            JSON.stringify(config || {}),
            agent_id,
            orgId
          ]
        );
      } else {
        result = await db.query(
          `UPDATE tts_configurations 
           SET provider = $1,
               voice_id = $2,
               voice_name = $3,
               language_code = $4,
               speaking_rate = $5,
               pitch = $6,
               volume_gain_db = $7,
               config = $8,
               updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = $9 AND organization_id IS NULL
           RETURNING *`,
          [
            provider,
            voice_id || null,
            voice_name || null,
            language_code || 'en-US',
            speaking_rate || 1.0,
            pitch || 0.0,
            volume_gain_db || 0.0,
            JSON.stringify(config || {}),
            agent_id
          ]
        );
      }
    } else {
      // Insert new configuration
      result = await db.query(
        `INSERT INTO tts_configurations (organization_id, agent_id, provider, voice_id, voice_name, language_code, speaking_rate, pitch, volume_gain_db, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          orgId || null,
          agent_id,
          provider,
          voice_id || null,
          voice_name || null,
          language_code || 'en-US',
          speaking_rate || 1.0,
          pitch || 0.0,
          volume_gain_db || 0.0,
          JSON.stringify(config || {})
        ]
      );
    }

    if (result.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to save TTS configuration' });
    }

    res.status(201).json({ configuration: result.rows[0] });
  } catch (error) {
    console.error('Error creating/updating TTS config:', error);
    res.status(500).json({ 
      message: 'Error creating TTS configuration',
      error: error.message 
    });
  }
});

// Consent Management
router.get('/consent', authenticateToken, async (req, res) => {
  try {
    const { phone_number } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    let query = 'SELECT * FROM consent_records WHERE organization_id = $1';
    const params = [orgId];

    if (phone_number) {
      query += ' AND phone_number = $2';
      params.push(phone_number);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ consents: result.rows });
  } catch (error) {
    console.error('Error fetching consents:', error);
    res.status(500).json({ message: 'Error fetching consent records' });
  }
});

// Create consent record
router.post('/consent', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { phone_number, consent_type, consent_method, consent_status, consent_text, expires_at, metadata } = req.body;

    const result = await db.query(
      `INSERT INTO consent_records (organization_id, phone_number, consent_type, consent_method, consent_status, consent_text, expires_at, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [orgId, phone_number, consent_type, consent_method, consent_status, consent_text, expires_at, req.ip, req.get('user-agent'), JSON.stringify(metadata || {})]
    );

    res.status(201).json({ consent: result.rows[0] });
  } catch (error) {
    console.error('Error creating consent:', error);
    res.status(500).json({ message: 'Error creating consent record' });
  }
});

// Synthesize speech using TTS
router.post('/tts/synthesize', authenticateToken, async (req, res) => {
  try {
    const { text, agent_id } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Get TTS configuration for agent
    let ttsConfig = null;
    if (agent_id) {
      const configResult = await db.query(
        'SELECT * FROM tts_configurations WHERE agent_id = $1 AND organization_id = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agent_id, orgId]
      );
      if (configResult.rows.length > 0) {
        ttsConfig = configResult.rows[0];
      }
    }

    // Use default ElevenLabs config if no agent config found
    if (!ttsConfig) {
      ttsConfig = {
        provider: 'elevenlabs',
        voice_id: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
        voice_name: 'Rachel',
        language_code: 'en-US',
        speaking_rate: 1.0,
        pitch: 0.0,
        volume_gain_db: 0.0,
        config: {}
      };
    }

    const result = await ttsService.synthesize(text, ttsConfig);

    res.json({
      success: true,
      audio: result.audio,
      format: result.format,
      provider: result.provider
    });
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    res.status(500).json({ 
      message: 'Error synthesizing speech',
      error: error.message 
    });
  }
});

// Get ElevenLabs voices
router.get('/tts/elevenlabs/voices', authenticateToken, async (req, res) => {
  try {
    const voices = await ttsService.getElevenLabsVoices();
    res.json({ voices });
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    res.status(500).json({ 
      message: 'Error fetching ElevenLabs voices',
      error: error.message 
    });
  }
});

// Test TTS configuration
router.post('/tts/test', authenticateToken, async (req, res) => {
  try {
    const { provider, voice_id, text, agent_id } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required for testing' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Try to get agent's TTS config if agent_id is provided
    let testConfig = null;
    if (agent_id) {
      let configResult;
      if (orgId) {
        configResult = await db.query(
          'SELECT * FROM tts_configurations WHERE agent_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1',
          [agent_id, orgId]
        );
      } else {
        configResult = await db.query(
          'SELECT * FROM tts_configurations WHERE agent_id = $1 AND organization_id IS NULL ORDER BY created_at DESC LIMIT 1',
          [agent_id]
        );
      }
      
      if (configResult.rows.length > 0) {
        testConfig = configResult.rows[0];
      }
    }

    // Use provided params or agent config, or fallback to defaults
    const finalConfig = {
      provider: provider || testConfig?.provider || 'elevenlabs',
      voice_id: voice_id || testConfig?.voice_id || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
      voice_name: testConfig?.voice_name || 'Test Voice',
      language_code: testConfig?.language_code || 'en-US',
      speaking_rate: testConfig?.speaking_rate || 1.0,
      pitch: testConfig?.pitch || 0.0,
      volume_gain_db: testConfig?.volume_gain_db || 0.0,
      config: testConfig?.config || {}
    };

    const result = await ttsService.synthesize(text, finalConfig);

    res.json({
      success: true,
      audio: result.audio,
      format: result.format,
      provider: result.provider,
      message: 'TTS test successful'
    });
  } catch (error) {
    console.error('TTS test error:', error);
    res.status(500).json({ 
      message: 'TTS test failed',
      error: error.message 
    });
  }
});

// Get call recordings
router.get('/recordings', authenticateToken, async (req, res) => {
  try {
    const { call_log_id } = req.query;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    let query = 'SELECT * FROM call_recordings WHERE organization_id = $1';
    const params = [orgId];

    if (call_log_id) {
      query += ' AND call_log_id = $2';
      params.push(call_log_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ recordings: result.rows });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ message: 'Error fetching call recordings' });
  }
});

module.exports = router;

