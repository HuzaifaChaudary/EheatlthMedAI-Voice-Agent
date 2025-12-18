const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');
const ttsService = require('../services/ttsService');
const router = express.Router();

// Get all conversations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Try with organization_id first, fallback to user-based query
    let result;
    try {
      result = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.organization_id = $1
         ORDER BY c.created_at DESC
         LIMIT 100`,
        [orgId]
      );
    } catch (error) {
      // Fallback if organization_id column doesn't exist
      result = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.user_id = $1
         ORDER BY c.created_at DESC
         LIMIT 100`,
        [req.user.id]
      );
    }

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Get conversation by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Try with organization_id first, fallback to user-based query
    let result;
    try {
      result = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type, a.system_prompt, a.temperature, a.max_tokens
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [id, orgId]
      );
    } catch (error) {
      // Fallback if organization_id column doesn't exist
      result = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type, a.system_prompt, a.temperature, a.max_tokens
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.id = $1 AND c.user_id = $2`,
        [id, req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ conversation: result.rows[0] });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Error fetching conversation' });
  }
});

// Create new conversation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    const { agent_id, patient_name, patient_phone, metadata } = req.body;

    if (!agent_id) {
      return res.status(400).json({ message: 'Agent ID is required' });
    }

    // Verify agent exists and belongs to organization
    const agentResult = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND organization_id = $2',
      [agent_id, orgId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const agent = agentResult.rows[0];

    // Check if conversations table has organization_id column
    // If not, we'll add user_id as fallback
    let result;
    try {
      result = await db.query(
        `INSERT INTO conversations (organization_id, agent_id, patient_name, patient_phone, status, transcript, metadata, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          orgId,
          agent_id,
          patient_name || null,
          patient_phone || null,
          'active',
          JSON.stringify([]),
          JSON.stringify(metadata || {}),
          req.user.id
        ]
      );
    } catch (error) {
      // Fallback if organization_id column doesn't exist
      result = await db.query(
        `INSERT INTO conversations (agent_id, patient_name, patient_phone, status, transcript, metadata, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          agent_id,
          patient_name || null,
          patient_phone || null,
          'active',
          JSON.stringify([]),
          JSON.stringify(metadata || {}),
          req.user.id
        ]
      );
    }

    const conversation = result.rows[0];

    // Get greeting message or generate one
    let greetingMessage = agent.greeting_message;
    if (!greetingMessage && agent.system_prompt) {
      try {
        const aiResponse = await aiService.processConversation({
          agentId: agent_id,
          agentConfig: {
            provider: agent.voice_model || 'openai',
            system_prompt: agent.system_prompt,
            temperature: agent.temperature || 0.7,
            max_tokens: agent.max_tokens || 1000,
            type: agent.type
          },
          conversationHistory: [],
          userMessage: 'Hello',
          context: {
            patientName: patient_name
          }
        });
        greetingMessage = aiResponse.content;
      } catch (error) {
        console.error('Error generating greeting:', error);
        greetingMessage = 'Hello! How can I help you today?';
      }
    }

    // Add greeting to transcript
    const transcript = [{
      role: 'assistant',
      content: greetingMessage || 'Hello! How can I help you today?',
      timestamp: new Date().toISOString()
    }];

    await db.query(
      'UPDATE conversations SET transcript = $1 WHERE id = $2',
      [JSON.stringify(transcript), conversation.id]
    );

    res.status(201).json({
      conversation: {
        ...conversation,
        transcript
      },
      greeting: greetingMessage
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Error creating conversation' });
  }
});

// Send message in conversation
router.post('/:id/message', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Get conversation with agent config
    // Try with organization_id first, fallback to user-based query
    let convResult;
    try {
      convResult = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type, a.system_prompt, 
                a.temperature, a.max_tokens, a.voice_model, a.fallback_message
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [id, orgId]
      );
    } catch (error) {
      // Fallback if organization_id column doesn't exist
      convResult = await db.query(
        `SELECT c.*, a.name as agent_name, a.type as agent_type, a.system_prompt, 
                a.temperature, a.max_tokens, a.voice_model, a.fallback_message
         FROM conversations c
         LEFT JOIN ai_agents a ON c.agent_id = a.id
         WHERE c.id = $1 AND c.user_id = $2`,
        [id, req.user.id]
      );
    }

    if (convResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];
    const agent = {
      provider: conversation.voice_model || 'openai',
      system_prompt: conversation.system_prompt,
      temperature: conversation.temperature || 0.7,
      max_tokens: conversation.max_tokens || 1000,
      type: conversation.agent_type
    };

    // Get current transcript
    const transcript = conversation.transcript || [];

    // Add user message to transcript
    transcript.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Generate AI response
    let aiResponse;
    try {
      aiResponse = await aiService.processConversation({
        agentId: conversation.agent_id,
        agentConfig: agent,
        conversationHistory: transcript.slice(0, -1), // Exclude current message
        userMessage: message,
        context: {
          patientName: conversation.patient_name,
          patientPhone: conversation.patient_phone
        }
      });

      // Generate audio for AI response if TTS is configured
      let audioData = null;
      try {
        // Get TTS configuration for agent
        const ttsConfigResult = await db.query(
          'SELECT * FROM tts_configurations WHERE agent_id = $1 AND organization_id = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [conversation.agent_id, orgId]
        );

        if (ttsConfigResult.rows.length > 0) {
          const ttsConfig = ttsConfigResult.rows[0];
          const ttsResult = await ttsService.synthesize(aiResponse.content, ttsConfig);
          audioData = ttsResult.audio;
        }
      } catch (ttsError) {
        console.error('TTS synthesis error (non-blocking):', ttsError);
        // Don't fail the conversation if TTS fails
      }

      // Add AI response to transcript
      transcript.push({
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date().toISOString(),
        usage: aiResponse.usage,
        model: aiResponse.model,
        audio: audioData ? { data: audioData, format: 'audio/mpeg' } : null
      });
    } catch (error) {
      console.error('AI processing error:', error);
      const fallbackMessage = conversation.fallback_message || 
        'I apologize, but I\'m experiencing technical difficulties. Please try again or contact support.';
      
      transcript.push({
        role: 'assistant',
        content: fallbackMessage,
        timestamp: new Date().toISOString(),
        error: error.message
      });

      aiResponse = {
        content: fallbackMessage,
        error: error.message
      };
    }

    // Update conversation
    await db.query(
      `UPDATE conversations 
       SET transcript = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(transcript), id]
    );

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'CONVERSATION_MESSAGE',
        'conversations',
        id,
        JSON.stringify({ message_length: message.length, has_error: !!aiResponse.error })
      ]
    );

    res.json({
      message: aiResponse.content,
      transcript,
      usage: aiResponse.usage,
      error: aiResponse.error,
      audio: audioData ? { data: audioData, format: 'audio/mpeg' } : null
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ message: 'Error processing message' });
  }
});

// Update conversation status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0].organization_id;

    // Try with organization_id first, fallback to user-based query
    let result;
    try {
      result = await db.query(
        `UPDATE conversations 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND organization_id = $3
         RETURNING *`,
        [status, id, orgId]
      );
    } catch (error) {
      // Fallback if organization_id column doesn't exist
      result = await db.query(
        `UPDATE conversations 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [status, id, req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ conversation: result.rows[0] });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ message: 'Error updating conversation' });
  }
});

module.exports = router;

