const express = require('express');
const db = require('../config/database');
const aiService = require('../services/aiService');
const router = express.Router();

// Create or get web chat conversation
router.post('/conversation', async (req, res) => {
  try {
    const { agent_id, organization_id, patient_name, patient_email, metadata } = req.body;

    if (!agent_id) {
      return res.status(400).json({ message: 'agent_id is required' });
    }

    // Get agent to determine organization if not provided
    let orgId = organization_id;
    if (!orgId) {
      const agentResult = await db.query(
        'SELECT organization_id FROM ai_agents WHERE id = $1',
        [agent_id]
      );
      if (agentResult.rows.length === 0) {
        return res.status(404).json({ message: 'Agent not found' });
      }
      orgId = agentResult.rows[0].organization_id;
    }

    // Get agent for greeting message
    const agentResult = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [agent_id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const agent = agentResult.rows[0];

    // Create greeting message
    const greetingMessage = agent.greeting_message || 'Hello! How can I help you today?';
    const initialTranscript = [{
      role: 'assistant',
      content: greetingMessage,
      timestamp: new Date().toISOString()
    }];

    // Create conversation
    // The conversations table has: user_id, agent_id, patient_name, patient_phone (not organization_id, patient_email)
    // Store organization_id in metadata instead
    const conversationMetadata = {
      ...(metadata || {}),
      organization_id: orgId,
      channel: 'web_chat'
    };
    if (patient_email) {
      conversationMetadata.patient_email = patient_email;
    }

    const conversationResult = await db.query(
      `INSERT INTO conversations (
        agent_id, patient_name, patient_phone,
        status, transcript, metadata, created_at
      ) VALUES ($1, $2, $3, 'active', $4::jsonb, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [agent_id, patient_name || null, null, JSON.stringify(initialTranscript), JSON.stringify(conversationMetadata)]
    );

    const conversation = conversationResult.rows[0];

    res.status(201).json({
      conversation_id: conversation.id,
      status: conversation.status,
      created_at: conversation.created_at,
      greeting_message: greetingMessage
    });
  } catch (error) {
    console.error('Error creating web chat conversation:', error);
    res.status(500).json({ 
      message: 'Error creating conversation', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Send message in web chat
router.post('/message', async (req, res) => {
  try {
    const { conversation_id, message, agent_id } = req.body;

    if (!conversation_id || !message) {
      return res.status(400).json({ message: 'conversation_id and message are required' });
    }

    // Get conversation
    const conversationResult = await db.query(
      'SELECT * FROM conversations WHERE id = $1',
      [conversation_id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const conversation = conversationResult.rows[0];
    const agentId = agent_id || conversation.agent_id;

    // Get agent
    const agentResult = await db.query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const agent = agentResult.rows[0];

    // Get NLU configuration (if table exists)
    let nluConfig = {};
    try {
      const nluResult = await db.query(
        'SELECT * FROM nlu_configurations WHERE agent_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agentId]
      );
      nluConfig = nluResult.rows[0] || {};
    } catch (error) {
      // NLU configurations table may not exist, use agent defaults
      console.log('NLU configurations table not found, using agent defaults');
    }

    // Get conversation history
    const history = conversation.transcript || [];

    // Get AI response (pass history WITHOUT the new message, as processConversation will add it)
    const aiResponse = await aiService.processConversation({
      agentId: agentId,
      agentConfig: {
        provider: nluConfig.provider || agent.voice_model || 'openai',
        model: nluConfig.model || (nluConfig.provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4'),
        system_prompt: nluConfig.system_prompt || agent.system_prompt,
        temperature: parseFloat(nluConfig.temperature || agent.temperature || 0.7),
        max_tokens: parseInt(nluConfig.max_tokens || agent.max_tokens || 1000),
        type: agent.type
      },
      conversationHistory: history,
      userMessage: message
    });

    // Add both user message and assistant response to history
    const userMessageEntry = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    const assistantMessageEntry = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date().toISOString()
    };
    
    const finalHistory = [...history, userMessageEntry, assistantMessageEntry];

    // Update conversation transcript
    await db.query(
      'UPDATE conversations SET transcript = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(finalHistory), conversation_id]
    );

    res.json({
      conversation_id: conversation_id,
      user_message: message,
      assistant_message: aiResponse.content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing web chat message:', error);
    res.status(500).json({ message: 'Error processing message', error: error.message });
  }
});

// Get conversation history
router.get('/conversation/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, aa.name as agent_name, aa.type as agent_type
       FROM conversations c
       LEFT JOIN ai_agents aa ON c.agent_id = aa.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const conversation = result.rows[0];

    res.json({
      conversation_id: conversation.id,
      agent_name: conversation.agent_name,
      agent_type: conversation.agent_type,
      messages: conversation.transcript || [],
      status: conversation.status,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Error fetching conversation', error: error.message });
  }
});

// Get available agents for web chat
router.get('/agents', async (req, res) => {
  try {
    const { organization_id } = req.query;

    let query = 'SELECT id, name, type, description FROM ai_agents WHERE is_active = true';
    const params = [];

    if (organization_id) {
      query += ' AND organization_id = $1';
      params.push(organization_id);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);

    res.json({
      agents: result.rows.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        description: agent.description
      }))
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Error fetching agents', error: error.message });
  }
});

module.exports = router;

