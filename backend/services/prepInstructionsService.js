/**
 * Prep Instructions Service
 * Handles sending prep instructions via SMS/email
 */

const db = require('../config/database');
const reminderService = require('./reminderService');

class PrepInstructionsService {
  /**
   * Send prep instructions to patient
   */
  async sendPrepInstructions(conversationId, instructionData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        appointment_id,
        instruction_type,
        custom_instructions
      } = instructionData;

      // Validate required fields
      if (!patient_name || !instruction_type) {
        throw new Error('Patient name and instruction type are required');
      }

      // Get prep instruction template
      const template = await this.getInstructionTemplate(instruction_type, organizationId);

      if (!template && !custom_instructions) {
        throw new Error(`No template found for instruction type: ${instruction_type}`);
      }

      const instructionsText = custom_instructions || template.instructions;

      // Send via SMS if phone provided
      let smsSent = false;
      let smsMessageId = null;
      if (patient_phone && (template?.send_via_sms || !template)) {
        try {
          const smsResult = await reminderService.sendSMSReminder(
            {
              patient_name,
              patient_phone,
              appointment_date: instructionData.appointment_date || new Date(),
              appointment_type: instructionData.appointment_type || 'Appointment'
            },
            organizationId,
            instructionsText
          );

          if (smsResult.success) {
            smsSent = true;
            smsMessageId = smsResult.message_id || null;
          }
        } catch (smsError) {
          console.error('Error sending prep instructions via SMS:', smsError);
        }
      }

      // Send via email if email provided
      let emailSent = false;
      let emailMessageId = null;
      if (patient_email && (template?.send_via_email || !template)) {
        try {
          const emailResult = await reminderService.sendEmailReminder(
            {
              patient_name,
              patient_email,
              appointment_date: instructionData.appointment_date || new Date(),
              appointment_type: instructionData.appointment_type || 'Appointment'
            },
            organizationId,
            `Preparation Instructions for Your ${instructionData.appointment_type || 'Appointment'}`,
            instructionsText
          );

          if (emailResult.success) {
            emailSent = true;
            emailMessageId = emailResult.message_id || null;
          }
        } catch (emailError) {
          console.error('Error sending prep instructions via email:', emailError);
        }
      }

      // Create record of sent instructions
      const result = await db.query(
        `INSERT INTO prep_instructions_sent (
          conversation_id, appointment_id, template_id,
          patient_name, patient_phone, patient_email,
          instruction_type, instructions_text,
          sent_via_sms, sent_via_email, sms_message_id, email_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          conversationId,
          appointment_id || null,
          template?.id || null,
          patient_name,
          patient_phone || null,
          patient_email || null,
          instruction_type,
          instructionsText,
          smsSent,
          emailSent,
          smsMessageId,
          emailMessageId
        ]
      );

      const sentInstruction = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('prep_instructions.sent', {
          prep_instruction_id: sentInstruction.id,
          conversation_id: conversationId,
          appointment_id: appointment_id,
          instruction_type: instruction_type,
          sent_via_sms: smsSent,
          sent_via_email: emailSent,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering prep_instructions.sent webhook:', webhookError);
      }

      return {
        prep_instruction: sentInstruction,
        sms_sent: smsSent,
        email_sent: emailSent,
        message: this.generateConfirmationMessage(smsSent, emailSent, instruction_type)
      };
    } catch (error) {
      console.error('Error sending prep instructions:', error);
      throw error;
    }
  }

  /**
   * Get instruction template
   */
  async getInstructionTemplate(instructionType, organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM prep_instruction_templates 
         WHERE organization_id = $1 
         AND instruction_type = $2 
         AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, instructionType]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Return default template if none found
      return this.getDefaultTemplate(instructionType);
    } catch (error) {
      console.error('Error getting instruction template:', error);
      return this.getDefaultTemplate(instructionType);
    }
  }

  /**
   * Get default templates for common instruction types
   */
  getDefaultTemplate(instructionType) {
    const defaultTemplates = {
      fasting_blood_test: {
        instructions: `PREPARATION INSTRUCTIONS FOR BLOOD TEST:

Please fast (no food or drinks except water) for at least 12 hours before your blood test.

- You may drink water
- Do not eat any food
- Do not drink coffee, tea, juice, or other beverages
- Take your regular medications unless instructed otherwise by your doctor
- If you have diabetes, consult your doctor about medication timing

Please arrive 15 minutes early for your appointment.`,
        send_via_sms: true,
        send_via_email: true,
        timing_hours_before: 12
      },
      imaging_mri: {
        instructions: `PREPARATION INSTRUCTIONS FOR MRI:

- Remove all metal objects (jewelry, watches, hairpins, etc.)
- Inform staff if you have any metal implants or devices
- Inform staff if you are pregnant or may be pregnant
- Inform staff if you have claustrophobia
- You may eat and drink normally unless told otherwise

Please arrive 30 minutes early for your appointment.`,
        send_via_sms: true,
        send_via_email: true,
        timing_hours_before: 24
      },
      imaging_ct: {
        instructions: `PREPARATION INSTRUCTIONS FOR CT SCAN:

- Inform staff if you have allergies to contrast dye
- Inform staff if you are pregnant or may be pregnant
- You may need to fast for 4 hours before the scan (check with your doctor)
- Drink plenty of water before your appointment

Please arrive 30 minutes early for your appointment.`,
        send_via_sms: true,
        send_via_email: true,
        timing_hours_before: 24
      },
      surgery_prep: {
        instructions: `PREPARATION INSTRUCTIONS FOR SURGERY:

- Do not eat or drink anything after midnight the night before surgery
- Take medications as instructed by your doctor
- Arrange for someone to drive you home after the procedure
- Follow any specific instructions provided by your surgeon

Please arrive 1 hour early for your appointment.`,
        send_via_sms: true,
        send_via_email: true,
        timing_hours_before: 24
      }
    };

    return defaultTemplates[instructionType] || null;
  }

  /**
   * Generate confirmation message
   */
  generateConfirmationMessage(smsSent, emailSent, instructionType) {
    const methods = [];
    if (smsSent) methods.push('SMS');
    if (emailSent) methods.push('email');

    if (methods.length === 0) {
      return 'Prep instructions could not be sent. Please contact the office for instructions.';
    }

    return `Prep instructions have been sent via ${methods.join(' and ')}. Please check your ${methods.join(' and ')} for details.`;
  }

  /**
   * Get prep instruction functions for OpenAI function calling
   */
  getPrepInstructionFunctions() {
    return [
      {
        name: 'send_prep_instructions',
        description: 'Send preparation instructions to a patient before their appointment. Use this when a patient needs instructions for fasting, imaging, surgery prep, etc.',
        parameters: {
          type: 'object',
          properties: {
            instruction_type: {
              type: 'string',
              description: 'Type of prep instructions needed',
              enum: ['fasting_blood_test', 'imaging_mri', 'imaging_ct', 'surgery_prep', 'lab_prep', 'other']
            },
            appointment_id: {
              type: 'number',
              description: 'ID of the associated appointment (if available)'
            },
            appointment_date: {
              type: 'string',
              description: 'Date and time of the appointment (ISO 8601 format)'
            },
            appointment_type: {
              type: 'string',
              description: 'Type of appointment (e.g., "Blood Test", "MRI", "Surgery")'
            },
            custom_instructions: {
              type: 'string',
              description: 'Custom instructions text (if template is not sufficient)'
            }
          },
          required: ['instruction_type']
        }
      }
    ];
  }
}

module.exports = new PrepInstructionsService();

