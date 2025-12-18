const express = require('express');
const aiService = require('../services/aiService');
const router = express.Router();

// Get AI service status and configuration
router.get('/', (req, res) => {
  try {
    const providers = aiService.getAvailableProviders();
    const status = {
      configured: providers.length > 0,
      providers: providers,
      openai: {
        configured: aiService.isConfigured('openai'),
        hasKey: !!process.env.OPENAI_API_KEY,
        hasOrgId: !!process.env.OPENAI_ORGANIZATION_ID
      },
      anthropic: {
        configured: aiService.isConfigured('anthropic'),
        hasKey: !!process.env.ANTHROPIC_API_KEY
      },
      mockMode: process.env.MOCK_AI_RESPONSES === 'true'
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting AI status:', error);
    res.status(500).json({ message: 'Error getting AI status' });
  }
});

// Test AI service
router.post('/test', async (req, res) => {
  try {
    const { provider = 'openai', message = 'Hello, how are you?' } = req.body;

    if (!aiService.isConfigured(provider) && process.env.MOCK_AI_RESPONSES !== 'true') {
      return res.status(400).json({ 
        message: `AI provider ${provider} is not configured`,
        availableProviders: aiService.getAvailableProviders()
      });
    }

    const response = await aiService.generateResponse({
      provider,
      model: provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: message }],
      systemPrompt: 'You are a helpful AI assistant.',
      temperature: 0.7,
      maxTokens: 100
    });

    res.json({
      success: true,
      provider,
      message,
      response: response.content,
      usage: response.usage,
      model: response.model
    });
  } catch (error) {
    console.error('Error testing AI:', error);
    res.status(500).json({ 
      message: 'Error testing AI service',
      error: error.message 
    });
  }
});

module.exports = router;

