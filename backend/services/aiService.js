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
    const systemPrompt = await this.buildSystemPrompt(agentConfig, context);
    
    const messages = this.buildMessageHistory(conversationHistory, userMessage);

    // Ensure numeric values are properly converted
    const temperature = typeof agentConfig.temperature === 'string' 
      ? parseFloat(agentConfig.temperature) 
      : (agentConfig.temperature || 0.7);
    const maxTokens = typeof agentConfig.max_tokens === 'string' 
      ? parseInt(agentConfig.max_tokens, 10) 
      : (agentConfig.max_tokens || 1000);

    // Add emergency forwarding function for all agents (voice calls)
    const emergencyForwardingService = require('./emergencyForwardingService');
    const forwardFunction = emergencyForwardingService.getForwardingFunction();
    
    // Add appointment booking functions for Front Desk agents
    let functions = agentConfig.functions || [forwardFunction];
    if (!functions.includes(forwardFunction)) {
      functions = [forwardFunction, ...(functions || [])];
    }
    
    // Add appointment booking functions for all agent types that can book appointments
    const normalizedType = agentConfig.type ? agentConfig.type.toLowerCase().replace(/\s+/g, '_') : '';
    const canBookAppointments = [
      'front_desk',
      'medical_assistant',
      'triage_nurse',
      'billing_specialist',
      'collections_specialist',
      'front_desk_assistant'
    ].includes(normalizedType);
    
    if (canBookAppointments) {
      const appointmentBookingService = require('./appointmentBookingService');
      const bookingFunctions = appointmentBookingService.getBookingFunctions();
      functions = functions ? [...functions, ...bookingFunctions] : bookingFunctions;
    }

    // Add Medical Assistant functions
    if (agentConfig.type && agentConfig.type.toLowerCase().replace(/\s+/g, '_') === 'medical_assistant') {
      const medicationRefillService = require('./medicationRefillService');
      const labResultsService = require('./labResultsService');
      const preVisitIntakeService = require('./preVisitIntakeService');
      const prepInstructionsService = require('./prepInstructionsService');
      
      const medicalFunctions = [
        ...medicationRefillService.getRefillFunctions(),
        ...labResultsService.getLabResultFunctions(),
        ...preVisitIntakeService.getIntakeFunctions(),
        ...prepInstructionsService.getPrepInstructionFunctions()
      ];
      
      functions = functions ? [...functions, ...medicalFunctions] : medicalFunctions;
    }

    // Add Triage Nurse functions
    if (agentConfig.type && agentConfig.type.toLowerCase().replace(/\s+/g, '_') === 'triage_nurse') {
      const symptomCheckerService = require('./symptomCheckerService');
      const emergencyServicesService = require('./emergencyServicesService');
      const providerScheduleService = require('./providerScheduleService');
      const emrTriageDocumentationService = require('./emrTriageDocumentationService');
      const appointmentBookingService = require('./appointmentBookingService');
      
      const triageFunctions = [
        ...symptomCheckerService.getSymptomCheckerFunctions(),
        ...emergencyServicesService.getEmergencyFunctions(),
        ...providerScheduleService.getProviderScheduleFunctions(),
        ...emrTriageDocumentationService.getEMRDocumentationFunctions(),
        ...appointmentBookingService.getBookingFunctions() // For scheduling visits
      ];
      
      functions = functions ? [...functions, ...triageFunctions] : triageFunctions;
    }

    // Add Billing Specialist functions
    if (agentConfig.type && agentConfig.type.toLowerCase().replace(/\s+/g, '_') === 'billing_specialist') {
      const statementExplanationService = require('./statementExplanationService');
      const insuranceQAService = require('./insuranceQAService');
      const paymentGatewayService = require('./paymentGatewayService');
      const paymentReceiptService = require('./paymentReceiptService');
      
      const billingFunctions = [
        ...statementExplanationService.getStatementExplanationFunctions(),
        ...insuranceQAService.getInsuranceQAFunctions(),
        ...paymentGatewayService.getPaymentGatewayFunctions(),
        ...paymentReceiptService.getReceiptFunctions()
      ];
      
      functions = functions ? [...functions, ...billingFunctions] : billingFunctions;
    }

    return await this.generateResponse({
      provider,
      model,
      messages,
      systemPrompt,
      temperature: isNaN(temperature) ? 0.7 : temperature,
      maxTokens: isNaN(maxTokens) ? 1000 : maxTokens,
      functions: functions,
      agentType: agentConfig.type
    });
  }

  /**
   * Build system prompt based on agent configuration
   */
  async buildSystemPrompt(agentConfig, context = {}) {
    let prompt = agentConfig.system_prompt || 'You are a helpful AI assistant.';

    // Add agent-specific context
    if (agentConfig.type) {
      const typePrompts = {
        'front_desk': 'You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. You do NOT need date of birth or doctor name to book - those are optional. If the patient provides their name and a date/time, call book_appointment right away. Do not ask for unnecessary information. Phone number and email are helpful but not required.',
        'medical_assistant': 'You are a medical assistant AI. Help patients with medication refill requests following safety protocols, explain lab test results using normal ranges, collect pre-visit intake information, and send preparation instructions. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient requests a medication refill, use the request_medication_refill function. When a patient asks about lab results, use the explain_lab_result function. When collecting intake information, use the start_intake_form or update_intake_form functions. When a patient needs prep instructions (like fasting before a blood test), use the send_prep_instructions function. Always remind patients to consult with their healthcare provider for medical advice.',
        'triage_nurse': 'You are a triage nurse AI assistant. Help assess patient symptoms, determine urgency levels, and follow protocol-driven pathways. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient describes symptoms, use the assess_symptoms function to perform structured symptom assessment. For critical or emergent cases with red flags (chest pain, difficulty breathing, stroke symptoms, severe bleeding, unconsciousness), use the call_emergency_services function immediately. For urgent cases, use get_available_providers to help schedule appointments. Always document triage interactions using document_triage_in_emr after completing assessments. For medical emergencies, immediately direct patients to call 911 or go to the emergency room.',
        'billing_specialist': 'You are a billing specialist AI assistant for a medical practice. Your role is to help patients with billing inquiries, account balances, payment options, insurance questions, and payment arrangements. IMPORTANT: When a patient wants to book, schedule, or make an appointment related to billing (like meeting with billing department), you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient asks about their statement or bill, use the explain_statement function. When a patient asks an insurance question, use the answer_insurance_question function. When a patient wants to make a payment, use the process_payment function. After a payment is processed, use the generate_payment_receipt function to send a receipt. If a patient asks about their account balance or billing information and you do not have that information in the conversation history, ask them to provide it or verify their information (such as account number, date of service, or patient name) so you can assist them. Do NOT say you cannot access data - instead, ask the patient for the information you need to help them. Use any information the patient shares in the conversation to provide personalized assistance.',
        'collections_specialist': 'You are a collections specialist AI assistant. Help patients resolve outstanding balances with empathy and professionalism. IMPORTANT: When a patient wants to book, schedule, or make an appointment to discuss payment arrangements, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient has an overdue balance, use the send_overdue_balance_reminder function to send reminders. When a patient wants to set up a payment plan, use the negotiate_payment_plan function first, then create_payment_plan after terms are agreed. Before sending SMS or making automated calls, ensure you have consent using grant_communication_consent. If a patient requests to be on the Do Not Call list, use add_to_do_not_call_list. For severely overdue balances, use create_collections_case to send to collections. Always be empathetic and help patients find solutions. You have access to the full conversation history, so use information shared by the patient in previous messages to provide personalized assistance.'
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
    
    // Add dynamic greeting context for front desk agents
    if (agentConfig.type && agentConfig.type.toLowerCase().replace(/\s+/g, '_') === 'front_desk') {
      const greetingService = require('./greetingService');
      const greetingContext = greetingService.buildGreetingContext(agentConfig);
      prompt += `\n\nCurrent time greeting: ${greetingContext.timeGreeting}`;
      prompt += `\n\nCurrent time: ${greetingContext.currentTime}`;
      prompt += `\n\nWithin business hours: ${greetingContext.isWithinBusinessHours ? 'Yes' : 'No'}`;
      prompt += `\n\nBusiness hours information:\n${greetingContext.businessHoursMessage}`;
    }
    
    if (context.businessHours) {
      prompt += `\n\nBusiness hours: ${JSON.stringify(context.businessHours)}`;
    }

    // Add FAQ context for front desk agents
    if (agentConfig.type && agentConfig.type.toLowerCase().replace(/\s+/g, '_') === 'front_desk' && context.organizationId) {
      try {
        const faqService = require('./faqService');
        const faqContext = await faqService.buildFAQContext(context.organizationId);
        if (faqContext.faqAvailable) {
          prompt += `\n\nFAQ Information (use this to answer common questions):`;
          prompt += `\n\nBusiness Hours: ${faqContext.hours}`;
          prompt += `\n\nDirections: ${faqContext.directions}`;
          prompt += `\n\nServices: ${faqContext.services}`;
        }
      } catch (error) {
        console.error('Error building FAQ context:', error);
        // Don't fail if FAQ context fails
      }
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

    // OpenAI requires at least one user message - add a default for initial greeting
    // This handles voice calls where the first interaction has no user input
    if (messages.length === 0 || !messages.some(m => m.role === 'user')) {
      messages.push({
        role: 'user',
        content: 'Hello, I am calling and need assistance.'
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

