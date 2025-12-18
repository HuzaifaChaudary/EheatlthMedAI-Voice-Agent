const dotenv = require('dotenv');
dotenv.config();

/**
 * AI Service - Handles all AI provider integrations
 * Supports OpenAI and Anthropic (Claude)
 */

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    this.openaiOrgId = process.env.OPENAI_ORGANIZATION_ID?.trim();
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
    this.mockResponses = process.env.MOCK_AI_RESPONSES === 'true';
  }

  /**
   * Generate AI response using configured provider
   */
  async generateResponse({
    provider = 'openai',
    model,
    messages,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 1000,
    functions = null,
    agentType = null
  }) {
    if (this.mockResponses) {
      return this.getMockResponse(agentType, messages);
    }

    try {
      switch (provider.toLowerCase()) {
        case 'openai':
          return await this.generateOpenAIResponse({
            model: model || 'gpt-4',
            messages,
            systemPrompt,
            temperature,
            maxTokens,
            functions
          });
        case 'anthropic':
        case 'claude':
          return await this.generateAnthropicResponse({
            model: model || 'claude-3-opus-20240229',
            messages,
            systemPrompt,
            temperature,
            maxTokens
          });
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`AI Service Error (${provider}):`, error);
      throw error;
    }
  }

  /**
   * Generate response using OpenAI
   */
  async generateOpenAIResponse({ model, messages, systemPrompt, temperature, maxTokens, functions }) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestMessages = [];
    
    if (systemPrompt) {
      requestMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add conversation messages
    requestMessages.push(...messages);

    // Ensure temperature and maxTokens are numbers, not strings
    const tempValue = typeof temperature === 'string' ? parseFloat(temperature) : (temperature || 0.7);
    const maxTokensValue = typeof maxTokens === 'string' ? parseInt(maxTokens, 10) : (maxTokens || 1000);

    const requestBody = {
      model: model || 'gpt-4',
      messages: requestMessages,
      temperature: isNaN(tempValue) ? 0.7 : tempValue,
      max_tokens: isNaN(maxTokensValue) ? 1000 : maxTokensValue
    };

    if (functions && functions.length > 0) {
      requestBody.functions = functions;
      requestBody.function_call = 'auto';
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.openaiApiKey}`
    };

    if (this.openaiOrgId) {
      headers['OpenAI-Organization'] = this.openaiOrgId;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    const choice = data.choices[0];
    return {
      content: choice.message.content,
      functionCall: choice.message.function_call || null,
      finishReason: choice.finish_reason,
      usage: data.usage,
      model: data.model
    };
  }

  /**
   * Generate response using Anthropic Claude
   */
  async generateAnthropicResponse({ model, messages, systemPrompt, temperature, maxTokens }) {
    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert messages format for Anthropic
    const system = systemPrompt || '';
    const conversationMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Ensure temperature and maxTokens are numbers, not strings
    const tempValue = typeof temperature === 'string' ? parseFloat(temperature) : (temperature || 0.7);
    const maxTokensValue = typeof maxTokens === 'string' ? parseInt(maxTokens, 10) : (maxTokens || 1000);

    const requestBody = {
      model: model || 'claude-3-opus-20240229',
      max_tokens: isNaN(maxTokensValue) ? 1000 : maxTokensValue,
      temperature: isNaN(tempValue) ? 0.7 : tempValue,
      system: system,
      messages: conversationMessages
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      finishReason: data.stop_reason,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens
      },
      model: data.model
    };
  }

  /**
   * Process conversation with agent context
   */
  async processConversation({
    agentId,
    agentConfig,
    conversationHistory,
    userMessage,
    context = {}
  }) {
    const provider = agentConfig.provider || 'openai';
    const model = agentConfig.model || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229');
    const systemPrompt = this.buildSystemPrompt(agentConfig, context);
    
    const messages = this.buildMessageHistory(conversationHistory, userMessage);

    // Ensure numeric values are properly converted
    const temperature = typeof agentConfig.temperature === 'string' 
      ? parseFloat(agentConfig.temperature) 
      : (agentConfig.temperature || 0.7);
    const maxTokens = typeof agentConfig.max_tokens === 'string' 
      ? parseInt(agentConfig.max_tokens, 10) 
      : (agentConfig.max_tokens || 1000);

    return await this.generateResponse({
      provider,
      model,
      messages,
      systemPrompt,
      temperature: isNaN(temperature) ? 0.7 : temperature,
      maxTokens: isNaN(maxTokens) ? 1000 : maxTokens,
      functions: agentConfig.functions || null,
      agentType: agentConfig.type
    });
  }

  /**
   * Build system prompt based on agent configuration
   */
  buildSystemPrompt(agentConfig, context = {}) {
    let prompt = agentConfig.system_prompt || 'You are a helpful AI assistant.';

    // Add agent-specific context
    if (agentConfig.type) {
      const typePrompts = {
        'front_desk': 'You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately.',
        'medical_assistant': 'You are a medical assistant AI. Provide helpful information about appointments, medications, and general health questions. Always remind patients to consult with their healthcare provider for medical advice.',
        'triage_nurse': 'You are a triage nurse AI assistant. Help assess patient needs and determine urgency. For medical emergencies, immediately direct patients to call 911 or go to the emergency room.',
        'billing_specialist': 'You are a billing specialist AI assistant for a medical practice. Your role is to help patients with billing inquiries, account balances, payment options, insurance questions, and payment arrangements. IMPORTANT: If a patient asks about their account balance or billing information and you do not have that information in the conversation history, ask them to provide it or verify their information (such as account number, date of service, or patient name) so you can assist them. Do NOT say you cannot access data - instead, ask the patient for the information you need to help them. Use any information the patient shares in the conversation to provide personalized assistance.',
        'collections_specialist': 'You are a collections specialist AI assistant. Help patients resolve outstanding balances with empathy and professionalism. You have access to the full conversation history, so use information shared by the patient in previous messages to provide personalized assistance.'
      };
      
      // Normalize type to lowercase with underscore for matching (handles "Billing Specialist" -> "billing_specialist")
      const normalizedType = agentConfig.type.toLowerCase().replace(/\s+/g, '_');
      
      if (typePrompts[normalizedType]) {
        prompt = typePrompts[normalizedType] + '\n\n' + prompt;
      }
    }

    // Add context information
    if (context.patientName) {
      prompt += `\n\nCurrent patient: ${context.patientName}`;
    }
    if (context.businessHours) {
      prompt += `\n\nBusiness hours: ${JSON.stringify(context.businessHours)}`;
    }

    // Important: Tell the AI it has access to conversation history and how to handle missing data
    prompt += '\n\nIMPORTANT: You have access to the full conversation history. Reference information shared earlier when relevant. If information is missing, ask the patient for it rather than saying you cannot access data. Always be helpful and proactive in gathering information needed to assist the patient.';

    return prompt;
  }

  /**
   * Build message history from conversation
   */
  buildMessageHistory(conversationHistory, userMessage) {
    const messages = [];

    // Add conversation history (exclude the current user message if it's already in history)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        // Skip if this is the current user message (it will be added separately)
        if (msg.role === 'user' && msg.content === userMessage) {
          return;
        }
        messages.push({
          role: msg.role || 'user',
          content: msg.content || msg.text || ''
        });
      });
    }

    // Add current user message at the end
    if (userMessage) {
      messages.push({
        role: 'user',
        content: userMessage
      });
    }

    return messages;
  }

  /**
   * Get mock response for testing
   */
  getMockResponse(agentType, messages) {
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    const mockResponses = {
      'front_desk': 'Thank you for calling. I can help you schedule an appointment. What date and time works best for you?',
      'medical_assistant': 'I understand your concern. For medical advice, please consult with your healthcare provider. I can help with appointment scheduling or general questions.',
      'triage_nurse': 'I understand you need medical assistance. Can you tell me more about your symptoms so I can help determine the appropriate level of care?',
      'billing_specialist': 'I can help you with billing questions. Would you like to discuss your account balance, payment options, or insurance coverage?',
      'collections_specialist': 'I\'m here to help resolve your account balance. Let\'s work together to find a payment solution that works for you.'
    };

    return {
      content: mockResponses[agentType] || 'I understand. How can I help you today?',
      finishReason: 'stop',
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      model: 'mock-model'
    };
  }

  /**
   * Check if AI service is configured
   */
  isConfigured(provider = 'openai') {
    if (this.mockResponses) return true;
    
    if (provider === 'openai') {
      return !!this.openaiApiKey;
    } else if (provider === 'anthropic') {
      return !!this.anthropicApiKey;
    }
    return false;
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    const providers = [];
    if (this.openaiApiKey) providers.push('openai');
    if (this.anthropicApiKey) providers.push('anthropic');
    if (this.mockResponses) providers.push('mock');
    return providers;
  }
}

module.exports = new AIService();

