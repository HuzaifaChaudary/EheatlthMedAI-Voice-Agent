/**
 * Appointment Booking Service
 * Handles automatic appointment booking from AI agent conversations
 */

const db = require('../config/database');

class AppointmentBookingService {
  /**
   * Book appointment automatically from conversation
   */
  async bookAppointment(conversationId, appointmentData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        appointment_date,
        appointment_type,
        notes
      } = appointmentData;

      // Validate required fields
      if (!patient_name || !appointment_date) {
        throw new Error('Patient name and appointment date are required');
      }

      // Validate date
      const appointmentDate = new Date(appointment_date);
      if (isNaN(appointmentDate.getTime())) {
        throw new Error('Invalid appointment date format');
      }

      // Check if appointment date is in the past
      if (appointmentDate < new Date()) {
        throw new Error('Appointment date cannot be in the past');
      }

      // Insert appointment
      const result = await db.query(
        `INSERT INTO appointments (
          conversation_id, patient_name, patient_phone, patient_email,
          appointment_date, appointment_type, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          conversationId,
          patient_name,
          patient_phone || null,
          patient_email || null,
          appointment_date,
          appointment_type || null,
          'scheduled',
          notes || null
        ]
      );

      const appointment = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('appointment.created', {
          appointment_id: appointment.id,
          conversation_id: conversationId,
          patient_name: appointment.patient_name,
          patient_phone: appointment.patient_phone,
          appointment_date: appointment.appointment_date,
          appointment_type: appointment.appointment_type,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering appointment.created webhook:', webhookError);
      }

      return appointment;
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw error;
    }
  }

  /**
   * Get appointment booking functions definition for OpenAI function calling
   */
  getBookingFunctions() {
    return [
      {
        name: 'book_appointment',
        description: 'Book a new appointment for a patient. Use this when the patient wants to schedule an appointment.',
        parameters: {
          type: 'object',
          properties: {
            patient_name: {
              type: 'string',
              description: 'Full name of the patient'
            },
            patient_phone: {
              type: 'string',
              description: 'Phone number of the patient (e.g., +1234567890)'
            },
            patient_email: {
              type: 'string',
              description: 'Email address of the patient'
            },
            appointment_date: {
              type: 'string',
              description: 'Date and time of the appointment in ISO 8601 format (e.g., 2025-01-20T10:00:00Z). Must be a future date and time.'
            },
            appointment_type: {
              type: 'string',
              description: 'Type of appointment (e.g., General Checkup, Follow-up, Consultation)'
            },
            notes: {
              type: 'string',
              description: 'Additional notes about the appointment'
            }
          },
          required: ['patient_name', 'appointment_date']
        }
      },
      {
        name: 'reschedule_appointment',
        description: 'Reschedule an existing appointment to a new date and time.',
        parameters: {
          type: 'object',
          properties: {
            appointment_id: {
              type: 'number',
              description: 'ID of the appointment to reschedule'
            },
            new_appointment_date: {
              type: 'string',
              description: 'New date and time for the appointment in ISO 8601 format (e.g., 2025-01-20T14:00:00Z)'
            },
            reason: {
              type: 'string',
              description: 'Reason for rescheduling'
            }
          },
          required: ['appointment_id', 'new_appointment_date']
        }
      },
      {
        name: 'cancel_appointment',
        description: 'Cancel an existing appointment.',
        parameters: {
          type: 'object',
          properties: {
            appointment_id: {
              type: 'number',
              description: 'ID of the appointment to cancel'
            },
            reason: {
              type: 'string',
              description: 'Reason for cancellation'
            }
          },
          required: ['appointment_id']
        }
      }
    ];
  }

  /**
   * Handle function call from AI
   */
  async handleFunctionCall(functionName, functionArguments, conversationId, organizationId, context) {
    try {
      const args = typeof functionArguments === 'string' ? JSON.parse(functionArguments) : functionArguments;

      switch (functionName) {
        case 'book_appointment':
          // Use patient info from conversation context if not provided
          const appointmentData = {
            patient_name: args.patient_name || context.patientName || 'Patient',
            patient_phone: args.patient_phone || context.patientPhone || null,
            patient_email: args.patient_email || null,
            appointment_date: args.appointment_date,
            appointment_type: args.appointment_type || null,
            notes: args.notes || null
          };

          const appointment = await this.bookAppointment(conversationId, appointmentData, organizationId);
          
          return {
            success: true,
            message: `Appointment successfully booked for ${appointmentData.patient_name} on ${new Date(appointmentData.appointment_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}.`,
            appointment_id: appointment.id,
            appointment: appointment
          };

        case 'reschedule_appointment':
          // Check if appointment exists and belongs to conversation
          const appointmentCheck = await db.query(
            'SELECT * FROM appointments WHERE id = $1 AND conversation_id = $2',
            [args.appointment_id, conversationId]
          );

          if (appointmentCheck.rows.length === 0) {
            return {
              success: false,
              message: 'Appointment not found or does not belong to this conversation'
            };
          }

          const newDate = new Date(args.new_appointment_date);
          if (isNaN(newDate.getTime())) {
            return {
              success: false,
              message: 'Invalid appointment date format'
            };
          }

          if (newDate < new Date()) {
            return {
              success: false,
              message: 'New appointment date cannot be in the past'
            };
          }

          const updateNotes = args.reason 
            ? `${appointmentCheck.rows[0].notes || ''}\n[Rescheduled: ${args.reason}]`.trim()
            : appointmentCheck.rows[0].notes;

          await db.query(
            'UPDATE appointments SET appointment_date = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [args.new_appointment_date, updateNotes, args.appointment_id]
          );

          return {
            success: true,
            message: `Appointment successfully rescheduled to ${newDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}.`
          };

        case 'cancel_appointment':
          const cancelCheck = await db.query(
            'SELECT * FROM appointments WHERE id = $1 AND conversation_id = $2',
            [args.appointment_id, conversationId]
          );

          if (cancelCheck.rows.length === 0) {
            return {
              success: false,
              message: 'Appointment not found or does not belong to this conversation'
            };
          }

          const cancelNotes = args.reason
            ? `${cancelCheck.rows[0].notes || ''}\n[Cancelled: ${args.reason}]`.trim()
            : cancelCheck.rows[0].notes;

          await db.query(
            'UPDATE appointments SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['cancelled', cancelNotes, args.appointment_id]
          );

          return {
            success: true,
            message: 'Appointment successfully cancelled.'
          };

        default:
          return {
            success: false,
            message: `Unknown function: ${functionName}`
          };
      }
    } catch (error) {
      console.error(`Error handling function call ${functionName}:`, error);
      return {
        success: false,
        message: error.message || 'Error processing appointment request'
      };
    }
  }
}

module.exports = new AppointmentBookingService();

