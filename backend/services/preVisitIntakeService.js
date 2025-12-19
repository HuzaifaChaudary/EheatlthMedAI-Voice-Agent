/**
 * Pre-Visit Intake Service
 * Handles pre-visit intake data collection
 */

const db = require('../config/database');

class PreVisitIntakeService {
  /**
   * Start or update pre-visit intake form
   */
  async startIntakeForm(conversationId, intakeData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        appointment_id,
        form_type,
        intake_data
      } = intakeData;

      // Validate required fields
      if (!patient_name || !intake_data) {
        throw new Error('Patient name and intake data are required');
      }

      // Check if intake form already exists
      let existingForm = await db.query(
        'SELECT * FROM pre_visit_intake_forms WHERE conversation_id = $1 AND status != $2',
        [conversationId, 'completed']
      );

      let result;
      if (existingForm.rows.length > 0) {
        // Update existing form
        result = await db.query(
          `UPDATE pre_visit_intake_forms 
           SET intake_data = $1, form_type = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [JSON.stringify(intake_data), form_type || 'general', existingForm.rows[0].id]
        );
      } else {
        // Create new form
        result = await db.query(
          `INSERT INTO pre_visit_intake_forms (
            conversation_id, appointment_id, patient_name, patient_phone, patient_email,
            form_type, intake_data, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            conversationId,
            appointment_id || null,
            patient_name,
            patient_phone || null,
            patient_email || null,
            form_type || 'general',
            JSON.stringify(intake_data),
            'in_progress'
          ]
        );
      }

      const intakeForm = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('intake.started', {
          intake_form_id: intakeForm.id,
          conversation_id: conversationId,
          appointment_id: appointment_id,
          form_type: form_type || 'general',
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering intake.started webhook:', webhookError);
      }

      return intakeForm;
    } catch (error) {
      console.error('Error starting intake form:', error);
      throw error;
    }
  }

  /**
   * Complete and submit intake form
   */
  async submitIntakeForm(intakeFormId, organizationId) {
    try {
      const result = await db.query(
        `UPDATE pre_visit_intake_forms 
         SET status = $1, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        ['completed', intakeFormId]
      );

      if (result.rows.length === 0) {
        throw new Error('Intake form not found');
      }

      const intakeForm = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('intake.completed', {
          intake_form_id: intakeForm.id,
          conversation_id: intakeForm.conversation_id,
          appointment_id: intakeForm.appointment_id,
          form_type: intakeForm.form_type,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering intake.completed webhook:', webhookError);
      }

      return intakeForm;
    } catch (error) {
      console.error('Error submitting intake form:', error);
      throw error;
    }
  }

  /**
   * Get intake form questions based on form type
   */
  getIntakeQuestions(formType = 'general') {
    const questionSets = {
      general: [
        { key: 'chief_complaint', question: 'What is the main reason for your visit today?', type: 'text' },
        { key: 'current_medications', question: 'What medications are you currently taking?', type: 'text' },
        { key: 'allergies', question: 'Do you have any allergies?', type: 'text' },
        { key: 'symptoms', question: 'What symptoms are you experiencing?', type: 'text' },
        { key: 'pain_level', question: 'On a scale of 1-10, what is your pain level?', type: 'number' }
      ],
      surgery_prep: [
        { key: 'last_ate', question: 'When did you last eat or drink?', type: 'datetime' },
        { key: 'current_medications', question: 'What medications did you take today?', type: 'text' },
        { key: 'allergies', question: 'Do you have any allergies?', type: 'text' },
        { key: 'medical_conditions', question: 'Do you have any medical conditions?', type: 'text' }
      ],
      lab_prep: [
        { key: 'fasting_status', question: 'Have you been fasting as instructed?', type: 'boolean' },
        { key: 'last_ate', question: 'When did you last eat?', type: 'datetime' },
        { key: 'medications_taken', question: 'Did you take any medications this morning?', type: 'text' }
      ],
      imaging_prep: [
        { key: 'contrast_allergy', question: 'Do you have any allergies to contrast dye?', type: 'boolean' },
        { key: 'pregnancy_status', question: 'Is there any chance you could be pregnant?', type: 'boolean' },
        { key: 'metal_implants', question: 'Do you have any metal implants or devices?', type: 'boolean' }
      ]
    };

    return questionSets[formType] || questionSets.general;
  }

  /**
   * Get intake form functions for OpenAI function calling
   */
  getIntakeFunctions() {
    return [
      {
        name: 'start_intake_form',
        description: 'Start collecting pre-visit intake information from a patient. Use this when a patient needs to complete intake forms before their visit.',
        parameters: {
          type: 'object',
          properties: {
            form_type: {
              type: 'string',
              description: 'Type of intake form (general, surgery_prep, lab_prep, imaging_prep)',
              enum: ['general', 'surgery_prep', 'lab_prep', 'imaging_prep']
            },
            appointment_id: {
              type: 'number',
              description: 'ID of the associated appointment (if available)'
            },
            intake_data: {
              type: 'object',
              description: 'Intake form data collected from the patient (key-value pairs)'
            }
          },
          required: ['intake_data']
        }
      },
      {
        name: 'update_intake_form',
        description: 'Update an existing pre-visit intake form with additional information.',
        parameters: {
          type: 'object',
          properties: {
            intake_data: {
              type: 'object',
              description: 'Additional intake form data to add or update'
            }
          },
          required: ['intake_data']
        }
      },
      {
        name: 'submit_intake_form',
        description: 'Mark the intake form as completed and submitted.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }
}

module.exports = new PreVisitIntakeService();

