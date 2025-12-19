const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');
const ttsService = require('../services/ttsService');
const webhookService = require('../services/webhookService');
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

    // Get greeting message or generate one with dynamic greeting service
    let greetingMessage = agent.greeting_message;
    if (!greetingMessage) {
      try {
        const greetingService = require('../services/greetingService');
        const businessHours = agent.business_hours || null;
        const isWithinHours = greetingService.isWithinBusinessHours(businessHours);
        greetingMessage = greetingService.generateGreeting(businessHours, patient_name, !isWithinHours);
      } catch (error) {
        console.error('Error generating dynamic greeting:', error);
        // Fallback to AI-generated greeting
        if (agent.system_prompt) {
          try {
            const aiResponse = await aiService.processConversation({
              agentId: agent_id,
              agentConfig: {
                provider: agent.voice_model || 'openai',
                system_prompt: agent.system_prompt,
                temperature: agent.temperature || 0.7,
                max_tokens: agent.max_tokens || 1000,
                type: agent.type,
                business_hours: agent.business_hours
              },
              conversationHistory: [],
              userMessage: 'Hello',
              context: {
                patientName: patient_name,
                organizationId: orgId
              }
            });
            greetingMessage = aiResponse.content;
          } catch (aiError) {
            console.error('Error generating AI greeting:', aiError);
            greetingMessage = 'Hello! How can I help you today?';
          }
        } else {
          greetingMessage = 'Hello! How can I help you today?';
        }
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

    // Trigger webhook event
    try {
      await webhookService.deliverWebhookEvent('conversation.created', {
        conversation_id: conversation.id,
        agent_id: agent_id,
        patient_name: patient_name,
        patient_phone: patient_phone
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering conversation.created webhook:', webhookError);
      // Don't fail the request if webhook fails
    }

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
      // Get organization ID for context
      const orgIdResult = await db.query(
        'SELECT organization_id FROM users WHERE id = $1',
        [conversation.user_id || req.user.id]
      );
      const orgId = orgIdResult.rows[0]?.organization_id || null;

      aiResponse = await aiService.processConversation({
        agentId: conversation.agent_id,
        agentConfig: {
          ...agent,
          business_hours: conversation.business_hours || null
        },
        conversationHistory: transcript.slice(0, -1), // Exclude current message
        userMessage: message,
        context: {
          patientName: conversation.patient_name,
          patientPhone: conversation.patient_phone,
          organizationId: orgId,
          conversationId: id
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
              id,
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
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
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
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
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
              id,
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
              [id, 'completed']
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
              id,
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
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
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
              [id]
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
              [id]
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
              [id]
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
          } else if (functionName === 'explain_statement') {
            const statementExplanationService = require('../services/statementExplanationService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const statementResult = await statementExplanationService.explainStatement(
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
                ...args
              },
              orgId
            );
            
            functionResult = {
              success: true,
              statement_id: statementResult.statement.id,
              explanation: statementResult.explanation,
              balance_due: statementResult.statement.balance_due
            };
          } else if (functionName === 'answer_insurance_question') {
            const insuranceQAService = require('../services/insuranceQAService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const qaResult = await insuranceQAService.answerInsuranceQuestion(
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
                ...args
              },
              orgId
            );
            
            functionResult = {
              success: true,
              question: qaResult.question,
              answer: qaResult.answer,
              source: qaResult.source
            };
          } else if (functionName === 'process_payment') {
            const paymentGatewayService = require('../services/paymentGatewayService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const paymentResult = await paymentGatewayService.processPayment(
              id,
              {
                patient_name: conversation.patient_name,
                patient_phone: conversation.patient_phone,
                ...args
              },
              orgId
            );
            
            functionResult = {
              success: true,
              payment_id: paymentResult.payment.id,
              payment_amount: paymentResult.payment.payment_amount,
              payment_status: paymentResult.payment.payment_status,
              transaction_id: paymentResult.payment.gateway_transaction_id
            };
          } else if (functionName === 'generate_payment_receipt') {
            const paymentReceiptService = require('../services/paymentReceiptService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const receiptResult = await paymentReceiptService.generateReceipt(
              args.payment_id,
              orgId
            );
            
            functionResult = {
              success: true,
              receipt_number: receiptResult.receipt.receipt_number,
              receipt_url: receiptResult.pdf_url,
              email_sent: receiptResult.email_sent,
              sms_sent: receiptResult.sms_sent
            };
          } else if (functionName === 'send_overdue_balance_reminder') {
            const collectionsReminderService = require('../services/collectionsReminderService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const reminder = await collectionsReminderService.createOverdueReminder(
              args.statement_id,
              {
                reminder_type: args.reminder_type,
                scheduled_send_date: args.scheduled_send_date
              },
              orgId
            );
            
            const sendResult = await collectionsReminderService.sendOverdueReminder(reminder.id, orgId);
            
            functionResult = {
              success: sendResult.success,
              reminder_id: reminder.id,
              reminder_type: reminder.reminder_type
            };
          } else if (functionName === 'negotiate_payment_plan') {
            const paymentPlanService = require('../services/paymentPlanService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const negotiationResult = await paymentPlanService.negotiatePaymentPlan(
              args.statement_id,
              args,
              orgId
            );
            
            functionResult = {
              success: true,
              proposed_terms: negotiationResult.proposed_terms,
              message: negotiationResult.message
            };
          } else if (functionName === 'create_payment_plan') {
            const paymentPlanService = require('../services/paymentPlanService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const statementResult = await db.query(
              'SELECT patient_name, patient_phone, patient_email, balance_due FROM patient_statements WHERE id = $1',
              [args.statement_id]
            );
            
            if (statementResult.rows.length === 0) {
              functionResult = {
                success: false,
                message: 'Statement not found'
              };
            } else {
              const statement = statementResult.rows[0];
              const plan = await paymentPlanService.createPaymentPlan(
                id,
                {
                  statement_id: args.statement_id,
                  patient_name: statement.patient_name,
                  patient_phone: statement.patient_phone,
                  patient_email: statement.patient_email,
                  total_amount: parseFloat(statement.balance_due),
                  monthly_payment_amount: args.monthly_payment_amount,
                  number_of_payments: args.number_of_payments,
                  payment_frequency: args.payment_frequency || 'monthly',
                  start_date: args.start_date
                },
                orgId
              );
              
              functionResult = {
                success: true,
                payment_plan_id: plan.id,
                monthly_payment: plan.monthly_payment_amount,
                number_of_payments: plan.number_of_payments
              };
            }
          } else if (functionName === 'grant_communication_consent') {
            const tcpaComplianceService = require('../services/tcpaComplianceService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const consent = await tcpaComplianceService.grantConsent(
              {
                patient_identifier: conversation.patient_phone || conversation.patient_email,
                consent_type: args.consent_type,
                consent_method: args.consent_method || 'verbal'
              },
              orgId
            );
            
            functionResult = {
              success: true,
              consent_id: consent.id,
              consent_type: consent.consent_type
            };
          } else if (functionName === 'revoke_communication_consent') {
            const tcpaComplianceService = require('../services/tcpaComplianceService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const revoked = await tcpaComplianceService.revokeConsent(
              conversation.patient_phone || conversation.patient_email,
              args.consent_type,
              orgId
            );
            
            functionResult = {
              success: true,
              revoked_count: revoked.length
            };
          } else if (functionName === 'add_to_do_not_call_list') {
            const tcpaComplianceService = require('../services/tcpaComplianceService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            await tcpaComplianceService.addToDoNotCallList(
              args.phone_number || conversation.patient_phone,
              orgId,
              args.reason || 'customer_request',
              req.user?.id || null
            );
            
            functionResult = {
              success: true,
              message: 'Added to Do Not Call list'
            };
          } else if (functionName === 'create_collections_case') {
            const collectionsSystemService = require('../services/collectionsSystemService');
            const args = typeof aiResponse.functionCall.arguments === 'string' 
              ? JSON.parse(aiResponse.functionCall.arguments) 
              : aiResponse.functionCall.arguments;
            
            const caseRecord = await collectionsSystemService.createCollectionsCase(
              args.statement_id,
              orgId,
              args.collections_system_id
            );
            
            functionResult = {
              success: true,
              case_id: caseRecord.id,
              case_status: caseRecord.case_status
            };
          }

          if (functionResult) {
            // Add function call and result to transcript
            transcript.push({
              role: 'assistant',
              content: null,
              function_call: aiResponse.functionCall,
              timestamp: new Date().toISOString()
            });

            transcript.push({
              role: 'function',
              name: aiResponse.functionCall.name,
              content: JSON.stringify(functionResult),
              timestamp: new Date().toISOString()
            });

            // Get final AI response with function result
            aiResponse = await aiService.processConversation({
              agentId: conversation.agent_id,
              agentConfig: {
                ...agent,
                business_hours: conversation.business_hours || null
              },
              conversationHistory: transcript,
              userMessage: null, // No new user message, just processing function result
              context: {
                patientName: conversation.patient_name,
                patientPhone: conversation.patient_phone,
                organizationId: orgId,
                conversationId: id
              }
            });
          } else {
            // Function call not recognized, continue with original response
            console.warn(`Unknown function call: ${aiResponse.functionCall.name}`);
          }
        } catch (functionError) {
          console.error('Error handling function call:', functionError);
          // Continue with original response if function call fails
        }
      }

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

