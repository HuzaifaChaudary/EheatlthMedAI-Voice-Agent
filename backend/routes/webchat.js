const express = require('express');
const db = require('../config/database');
const aiService = require('../services/aiService');
const webhookService = require('../services/webhookService');
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

    // Trigger webhook events
    try {
      // Trigger both conversation.created and conversation.started for compatibility
      await webhookService.deliverWebhookEvent('conversation.created', {
        conversation_id: conversation.id,
        agent_id: agent_id,
        patient_name: patient_name,
        patient_email: patient_email,
        channel: 'web_chat'
      }, orgId);

      await webhookService.deliverWebhookEvent('conversation.started', {
        conversation_id: conversation.id,
        agent_id: agent_id,
        patient_name: patient_name,
        patient_email: patient_email,
        channel: 'web_chat'
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering webhook events:', webhookError);
      // Don't fail the request if webhook fails
    }

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
    
    // Get organization_id from agent or conversation metadata
    let orgId = agent.organization_id;
    if (!orgId && conversation.metadata) {
      try {
        const metadata = typeof conversation.metadata === 'string' 
          ? JSON.parse(conversation.metadata) 
          : conversation.metadata;
        orgId = metadata.organization_id;
      } catch (error) {
        console.error('Error parsing conversation metadata:', error);
      }
    }
    
    // Fallback: try to get from conversation's organization_id if it exists
    if (!orgId && conversation.organization_id) {
      orgId = conversation.organization_id;
    }

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
    let aiResponse = await aiService.processConversation({
      agentId: agentId,
      agentConfig: {
        provider: nluConfig.provider || agent.voice_model || 'openai',
        model: nluConfig.model || (nluConfig.provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4'),
        system_prompt: nluConfig.system_prompt || agent.system_prompt,
        temperature: parseFloat(nluConfig.temperature || agent.temperature || 0.7),
        max_tokens: parseInt(nluConfig.max_tokens || agent.max_tokens || 1000),
        type: agent.type,
        business_hours: agent.business_hours || null
      },
      conversationHistory: history,
      userMessage: message,
      context: {
        patientName: conversation.patient_name,
        patientPhone: conversation.patient_phone,
        organizationId: orgId,
        conversationId: conversation_id
      }
    });

    // Handle function calling for appointment booking and Medical Assistant functions
    if (aiResponse.functionCall) {
      let functionResult = null;
      
      try {
        // Determine which service to use based on function name
        const functionName = aiResponse.functionCall.name;
        
        if (functionName.startsWith('book_appointment') || functionName.startsWith('reschedule_appointment') || functionName.startsWith('cancel_appointment')) {
          const appointmentBookingService = require('../services/appointmentBookingService');
          functionResult = await appointmentBookingService.handleFunctionCall(
            aiResponse.functionCall.name,
            aiResponse.functionCall.arguments,
            conversation_id,
            orgId,
            {
              patientName: conversation.patient_name,
              patientPhone: conversation.patient_phone
            }
          );
        } else if (functionName === 'request_medication_refill') {
          const medicationRefillService = require('../services/medicationRefillService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          // Get active EHR system for organization (for EMR medication history lookup)
          let ehrSystemId = null;
          try {
            const ehrResult = await db.query(
              'SELECT id FROM ehr_systems WHERE organization_id = $1 AND is_active = true AND ehr_type != $2 ORDER BY created_at DESC LIMIT 1',
              [orgId, 'lab']
            );
            if (ehrResult.rows.length > 0) {
              ehrSystemId = ehrResult.rows[0].id;
            }
          } catch (ehrError) {
            console.error('Error getting EHR system (non-blocking):', ehrError);
          }
          
          const refillResult = await medicationRefillService.processRefillRequest(
            conversation_id,
            {
              patient_name: conversation.patient_name,
              patient_phone: conversation.patient_phone,
              patient_email: conversation.patient_email,
              ...args
            },
            orgId,
            ehrSystemId
          );
          
          functionResult = {
            success: true,
            message: refillResult.message,
            refill_request_id: refillResult.refill_request.id,
            status: refillResult.refill_request.status
          };
        } else if (functionName === 'explain_lab_result') {
          const labResultsService = require('../services/labResultsService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          // Get active lab system for organization (for lab results retrieval)
          let labSystemId = null;
          try {
            const labResult = await db.query(
              'SELECT id FROM ehr_systems WHERE organization_id = $1 AND is_active = true AND ehr_type = $2 ORDER BY created_at DESC LIMIT 1',
              [orgId, 'lab']
            );
            if (labResult.rows.length > 0) {
              labSystemId = labResult.rows[0].id;
            }
          } catch (labError) {
            console.error('Error getting lab system (non-blocking):', labError);
          }
          
          const labResult = await labResultsService.explainLabResult(
            conversation_id,
            {
              patient_name: conversation.patient_name,
              patient_phone: conversation.patient_phone,
              patient_email: conversation.patient_email,
              ...args
            },
            orgId,
            labSystemId
          );
          
          functionResult = {
            success: true,
            explanation: labResult.explanation,
            lab_result_id: labResult.lab_result.id,
            status: labResult.lab_result.status
          };
        } else if (functionName === 'start_intake_form' || functionName === 'update_intake_form') {
          const preVisitIntakeService = require('../services/preVisitIntakeService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          const intakeForm = await preVisitIntakeService.startIntakeForm(
            conversation_id,
            {
              patient_name: conversation.patient_name,
              patient_phone: conversation.patient_phone,
              ...args
            },
            orgId
          );
          
          functionResult = {
            success: true,
            message: functionName === 'start_intake_form' 
              ? 'Intake form started. Please continue providing the requested information.'
              : 'Intake form updated with new information.',
            intake_form_id: intakeForm.id,
            status: intakeForm.status
          };
        } else if (functionName === 'submit_intake_form') {
          const preVisitIntakeService = require('../services/preVisitIntakeService');
          
          // Get the intake form ID from conversation
          const intakeFormResult = await db.query(
            'SELECT id FROM pre_visit_intake_forms WHERE conversation_id = $1 AND status != $2 ORDER BY created_at DESC LIMIT 1',
            [conversation_id, 'completed']
          );
          
          if (intakeFormResult.rows.length === 0) {
            functionResult = {
              success: false,
              message: 'No intake form found to submit. Please start an intake form first.'
            };
          } else {
            const submittedForm = await preVisitIntakeService.submitIntakeForm(
              intakeFormResult.rows[0].id,
              orgId
            );
            
            functionResult = {
              success: true,
              message: 'Intake form submitted successfully. Thank you for completing the form.',
              intake_form_id: submittedForm.id
            };
          }
        } else if (functionName === 'send_prep_instructions') {
          const prepInstructionsService = require('../services/prepInstructionsService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          const prepResult = await prepInstructionsService.sendPrepInstructions(
            conversation_id,
            {
              patient_name: conversation.patient_name,
              patient_phone: conversation.patient_phone,
              ...args
            },
            orgId
          );
          
          functionResult = {
            success: true,
            message: prepResult.message,
            prep_instruction_id: prepResult.prep_instruction.id,
            sms_sent: prepResult.sms_sent,
            email_sent: prepResult.email_sent
          };
        } else if (functionName === 'assess_symptoms') {
          const symptomCheckerService = require('../services/symptomCheckerService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          const assessmentResult = await symptomCheckerService.assessSymptoms(
            conversation_id,
            {
              patient_name: conversation.patient_name,
              patient_phone: conversation.patient_phone,
              patient_email: conversation.patient_email,
              ...args
            },
            orgId
          );
          
          functionResult = {
            success: true,
            assessment_id: assessmentResult.assessment.id,
            severity_score: assessmentResult.severity_score,
            urgency_level: assessmentResult.urgency_level,
            red_flags: assessmentResult.red_flags,
            recommendation: assessmentResult.recommendation
          };
        } else if (functionName === 'call_emergency_services') {
          const emergencyServicesService = require('../services/emergencyServicesService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          // Get latest triage assessment for this conversation
          const assessmentResult = await db.query(
            'SELECT id FROM triage_assessments WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
            [conversation_id]
          );
          
          if (assessmentResult.rows.length === 0) {
            functionResult = {
              success: false,
              message: 'No triage assessment found. Please complete symptom assessment first.'
            };
          } else {
            const emergencyResult = await emergencyServicesService.callEmergencyServices(
              assessmentResult.rows[0].id,
              {
                patient_location: args.patient_location,
                emergency_type: args.emergency_type,
                additional_info: args.additional_info
              },
              orgId
            );
            
            functionResult = {
              success: true,
              message: emergencyResult.message,
              emergency_call_id: emergencyResult.emergency_call.id
            };
          }
        } else if (functionName === 'get_available_providers') {
          const providerScheduleService = require('../services/providerScheduleService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          const providers = await providerScheduleService.getAvailableProviders(
            orgId,
            args.urgency_level || 'routine',
            args.preferred_time
          );
          
          functionResult = {
            success: true,
            providers: providers,
            count: providers.length
          };
        } else if (functionName === 'connect_to_provider') {
          const providerScheduleService = require('../services/providerScheduleService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          // Get latest triage assessment for this conversation
          const assessmentResult = await db.query(
            'SELECT id FROM triage_assessments WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
            [conversation_id]
          );
          
          if (assessmentResult.rows.length === 0) {
            functionResult = {
              success: false,
              message: 'No triage assessment found. Please complete symptom assessment first.'
            };
          } else {
            const connectionResult = await providerScheduleService.connectToProviderSchedule(
              assessmentResult.rows[0].id,
              args.provider_id,
              orgId
            );
            
            functionResult = {
              success: true,
              provider_id: connectionResult.provider_id,
              provider_name: connectionResult.provider_name,
              provider_phone: connectionResult.provider_phone,
              next_available: connectionResult.next_available
            };
          }
        } else if (functionName === 'document_triage_in_emr') {
          const emrTriageDocumentationService = require('../services/emrTriageDocumentationService');
          const args = typeof aiResponse.functionCall.arguments === 'string' 
            ? JSON.parse(aiResponse.functionCall.arguments) 
            : aiResponse.functionCall.arguments;
          
          // Get latest triage assessment for this conversation
          const assessmentResult = await db.query(
            'SELECT id FROM triage_assessments WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
            [conversation_id]
          );
          
          if (assessmentResult.rows.length === 0) {
            functionResult = {
              success: false,
              message: 'No triage assessment found. Please complete symptom assessment first.'
            };
          } else {
            // Get EHR system ID
            let ehrSystemId = args.ehr_system_id;
            if (!ehrSystemId) {
              const ehrResult = await db.query(
                'SELECT id FROM ehr_systems WHERE organization_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
                [orgId]
              );
              if (ehrResult.rows.length > 0) {
                ehrSystemId = ehrResult.rows[0].id;
              }
            }
            
            if (!ehrSystemId) {
              functionResult = {
                success: false,
                message: 'No EHR system configured. Please configure an EHR system first.'
              };
            } else {
              const docResult = await emrTriageDocumentationService.documentTriageInEMR(
                assessmentResult.rows[0].id,
                ehrSystemId,
                orgId
              );
              
              functionResult = {
                success: true,
                documentation_id: docResult.documentation_id,
                ehr_system: docResult.ehr_system,
                status: docResult.status
              };
            }
          }
        }

        // Add function call and result to conversation history
        history.push({
          role: 'assistant',
          content: null,
          function_call: aiResponse.functionCall,
          timestamp: new Date().toISOString()
        });

        history.push({
          role: 'function',
          name: aiResponse.functionCall.name,
          content: JSON.stringify(functionResult),
          timestamp: new Date().toISOString()
        });

        // Get final AI response with function result
        aiResponse = await aiService.processConversation({
          agentId: agentId,
          agentConfig: {
            provider: nluConfig.provider || agent.voice_model || 'openai',
            model: nluConfig.model || (nluConfig.provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4'),
            system_prompt: nluConfig.system_prompt || agent.system_prompt,
            temperature: parseFloat(nluConfig.temperature || agent.temperature || 0.7),
            max_tokens: parseInt(nluConfig.max_tokens || agent.max_tokens || 1000),
            type: agent.type,
            business_hours: agent.business_hours || null
          },
          conversationHistory: history,
          userMessage: null, // No new user message, just processing function result
          context: {
            patientName: conversation.patient_name,
            patientPhone: conversation.patient_phone,
            organizationId: orgId,
            conversationId: conversation_id
          }
        });
      } catch (functionError) {
        console.error('Error handling function call:', functionError);
        // Continue with original response if function call fails
      }
    }

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

    // Trigger webhook event for message
    try {
      let orgId = null;
      try {
        const agentOrgResult = await db.query(
          'SELECT organization_id FROM ai_agents WHERE id = $1',
          [agentId]
        );
        if (agentOrgResult.rows.length > 0) {
          orgId = agentOrgResult.rows[0].organization_id;
        }
      } catch (error) {
        console.error('Error getting organization from agent:', error);
      }

      await webhookService.deliverWebhookEvent('conversation.message', {
        conversation_id: conversation_id,
        user_message: message,
        assistant_message: aiResponse.content,
        agent_id: agentId
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering conversation.message webhook:', webhookError);
      // Don't fail the request if webhook fails
    }

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

