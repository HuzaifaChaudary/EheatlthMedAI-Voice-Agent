const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all AI agents for user's organization
// Admin users can optionally filter by organization_id query param
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;
    
    // If admin user and organization_id is provided, show that org's agents
    if (req.user.role === 'admin' && organization_id) {
      const result = await db.query(
        `SELECT id, name, type, description, is_active, configuration, 
                voice_model, voice_settings, system_prompt, temperature, max_tokens,
                phone_number_id, calendar_integration_id, greeting_message, fallback_message, business_hours,
                escalation_rules, created_at, organization_id
         FROM ai_agents 
         WHERE organization_id = $1
         ORDER BY type, name`,
        [organization_id]
      );
      return res.json({ agents: result.rows || [] });
    }

    // Regular users or admin without org filter: show only their organization's agents
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id;

    if (!orgId) {
      // User has no organization - return empty array (proper isolation)
      return res.json({ agents: [] });
    }

    // Query with organization_id (proper isolation)
    const result = await db.query(
      `SELECT id, name, type, description, is_active, configuration, 
              voice_model, voice_settings, system_prompt, temperature, max_tokens,
              phone_number_id, calendar_integration_id, greeting_message, fallback_message, business_hours,
              escalation_rules, created_at, organization_id
       FROM ai_agents 
       WHERE organization_id = $1
       ORDER BY type, name`,
      [orgId]
    );

    res.json({
      agents: result.rows || []
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    // If table doesn't exist or other error, return empty array
    res.json({ agents: [] });
  }
});

// Get agent by ID (with organization isolation)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's organization
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    // Admin can access any agent, regular users only their org's agents
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        'SELECT id, name, type, description, is_active, configuration, phone_number_id, calendar_integration_id, voice_model, system_prompt, temperature, max_tokens, greeting_message, escalation_rules, created_at, organization_id FROM ai_agents WHERE id = $1',
        [id]
      );
    } else if (orgId) {
      result = await db.query(
        'SELECT id, name, type, description, is_active, configuration, phone_number_id, calendar_integration_id, voice_model, system_prompt, temperature, max_tokens, greeting_message, escalation_rules, created_at, organization_id FROM ai_agents WHERE id = $1 AND organization_id = $2',
        [id, orgId]
      );
    } else {
      return res.status(403).json({ message: 'Access denied. No organization assigned.' });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ message: 'Error fetching AI agent' });
  }
});

// Create new agent
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const {
      name, type, description, configuration,
      voice_model, voice_settings, system_prompt, temperature, max_tokens,
      phone_number_id, calendar_integration_id, greeting_message, fallback_message, business_hours,
      escalation_rules
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const result = await db.query(
      `INSERT INTO ai_agents (
        organization_id, name, type, description, configuration,
        voice_model, voice_settings, system_prompt, temperature, max_tokens,
        phone_number_id, calendar_integration_id, greeting_message, fallback_message, business_hours,
        escalation_rules
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        orgId, name, type, description || null,
        configuration ? JSON.stringify(configuration) : null,
        voice_model || 'openai', voice_settings ? JSON.stringify(voice_settings) : null,
        system_prompt || null, temperature || 0.7, max_tokens || 1000,
        phone_number_id || null, calendar_integration_id || null, greeting_message || null, fallback_message || null,
        business_hours ? JSON.stringify(business_hours) : null,
        escalation_rules ? JSON.stringify(escalation_rules) : null
      ]
    );

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'CREATE_AGENT',
        'ai_agents',
        result.rows[0].id,
        JSON.stringify({ name, type })
      ]
    );

    res.status(201).json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ message: 'Error creating AI agent' });
  }
});

// Update agent
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;

    const {
      name, type, description, is_active, configuration,
      voice_model, voice_settings, system_prompt, temperature, max_tokens,
      phone_number_id, calendar_integration_id, greeting_message, fallback_message, business_hours,
      escalation_rules
    } = req.body;

    const result = await db.query(
      `UPDATE ai_agents 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           configuration = COALESCE($5::jsonb, configuration),
           voice_model = COALESCE($6, voice_model),
           voice_settings = COALESCE($7::jsonb, voice_settings),
           system_prompt = COALESCE($8, system_prompt),
           temperature = COALESCE($9, temperature),
           max_tokens = COALESCE($10, max_tokens),
           phone_number_id = COALESCE($11, phone_number_id),
           calendar_integration_id = COALESCE($12, calendar_integration_id),
           greeting_message = COALESCE($13, greeting_message),
           fallback_message = COALESCE($14, fallback_message),
           business_hours = COALESCE($15::jsonb, business_hours),
           escalation_rules = COALESCE($16::jsonb, escalation_rules),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17 AND organization_id = $18
       RETURNING *`,
      [
        name || null, type || null, description || null,
        is_active !== undefined ? is_active : null,
        configuration ? JSON.stringify(configuration) : null,
        voice_model || null, voice_settings ? JSON.stringify(voice_settings) : null,
        system_prompt || null, temperature || null, max_tokens || null,
        phone_number_id || null, calendar_integration_id || null, greeting_message || null, fallback_message || null,
        business_hours ? JSON.stringify(business_hours) : null,
        escalation_rules ? JSON.stringify(escalation_rules) : null,
        id, orgId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'UPDATE_AGENT',
        'ai_agents',
        id,
        JSON.stringify({ changes: req.body })
      ]
    );

    res.json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ message: 'Error updating AI agent' });
  }
});

// Test AI agent response
router.post('/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Get agent
    let agentResult;
    if (orgId) {
      agentResult = await db.query(
        'SELECT * FROM ai_agents WHERE id = $1 AND organization_id = $2',
        [id, orgId]
      );
    } else {
      agentResult = await db.query(
        'SELECT * FROM ai_agents WHERE id = $1 AND organization_id IS NULL',
        [id]
      );
    }

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const agent = agentResult.rows[0];

    // Get NLU config if available
    let nluResult;
    if (orgId) {
      nluResult = await db.query(
        'SELECT * FROM nlu_configurations WHERE agent_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1',
        [id, orgId]
      );
    } else {
      nluResult = await db.query(
        'SELECT * FROM nlu_configurations WHERE agent_id = $1 AND organization_id IS NULL ORDER BY created_at DESC LIMIT 1',
        [id]
      );
    }

    const nluConfig = nluResult.rows[0] || {};

    const aiService = require('../services/aiService');

    const testMessage = message || 'Hello, I need help with an appointment.';
    const provider = nluConfig.provider || agent.voice_model || 'openai';

    // Check if provider is configured
    if (!aiService.isConfigured(provider) && process.env.MOCK_AI_RESPONSES !== 'true') {
      return res.status(400).json({ 
        message: `AI provider "${provider}" is not configured`,
        error: `Please set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} in your .env file, or set MOCK_AI_RESPONSES=true for testing`,
        availableProviders: aiService.getAvailableProviders(),
        suggestion: 'Set MOCK_AI_RESPONSES=true in your .env file to test without API keys'
      });
    }

    try {
      // Ensure numeric values are properly converted
      const temperature = parseFloat(nluConfig.temperature || agent.temperature || 0.7);
      const maxTokens = parseInt(nluConfig.max_tokens || agent.max_tokens || 1000, 10);

      const aiResponse = await aiService.processConversation({
        agentId: id,
        agentConfig: {
          provider: provider,
          model: nluConfig.model || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229'),
          system_prompt: nluConfig.system_prompt || agent.system_prompt,
          temperature: isNaN(temperature) ? 0.7 : temperature,
          max_tokens: isNaN(maxTokens) ? 1000 : maxTokens,
          type: agent.type
        },
        conversationHistory: [],
        userMessage: testMessage
      });

      res.json({
        success: true,
        userMessage: testMessage,
        aiResponse: aiResponse.content,
        usage: aiResponse.usage,
        model: aiResponse.model,
        provider: provider,
        isMock: process.env.MOCK_AI_RESPONSES === 'true'
      });
    } catch (aiError) {
      console.error('AI Service Error:', aiError);
      res.status(500).json({ 
        message: 'Error generating AI response',
        error: aiError.message,
        suggestion: 'Check your API keys and network connection, or set MOCK_AI_RESPONSES=true for testing'
      });
    }
  } catch (error) {
    console.error('Error testing agent:', error);
    res.status(500).json({ 
      message: 'Error testing agent',
      error: error.message,
      details: error.stack
    });
  }
});

module.exports = router;

