const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const ttsService = require('../services/ttsService');
const router = express.Router();

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

