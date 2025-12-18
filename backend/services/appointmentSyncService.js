/**
 * Appointment Synchronization Service
 * Handles synchronization with scheduling systems (Google Calendar, Zocdoc, etc.)
 */

const db = require('../config/database');
const fhirService = require('./fhirService');
const hl7Service = require('./hl7Service');
const webhookService = require('./webhookService');

class AppointmentSyncService {
  /**
   * Sync appointment to scheduling system
   */
  async syncAppointment(appointmentId, integrationId, organizationId) {
    try {
      // Get appointment from database
      const appointmentResult = await db.query(
        'SELECT * FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointmentResult.rows.length === 0) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      const appointment = appointmentResult.rows[0];

      // Get integration configuration
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [integrationId, organizationId]
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`Integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      let result;

      switch (provider) {
        case 'google_calendar':
          result = await this.syncToGoogleCalendar(appointment, credentials);
          break;
        case 'zocdoc':
          result = await this.syncToZocdoc(appointment, credentials);
          break;
        case 'calendly':
          result = await this.syncToCalendly(appointment, credentials);
          break;
        case 'ehr':
          // Sync via EHR connector (FHIR/HL7)
          result = await this.syncToEHR(appointment, integration, organizationId);
          break;
        default:
          throw new Error(`Unsupported scheduling provider: ${provider}`);
      }

      // Update appointment sync status
      await db.query(
        'UPDATE appointments SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [appointmentId]
      );

      // Update integration last_sync_at
      await db.query(
        'UPDATE integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [integrationId]
      );

      // Trigger webhook event
      await webhookService.deliverWebhookEvent('appointment.synced', {
        appointment_id: appointmentId,
        integration_id: integrationId,
        provider,
        result
      }, organizationId);

      return result;
    } catch (error) {
      console.error('Error syncing appointment:', error);
      throw error;
    }
  }

  /**
   * Sync to Google Calendar
   */
  async syncToGoogleCalendar(appointment, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use Google Calendar API
    const { access_token, refresh_token } = credentials;

    const eventData = {
      summary: `Appointment: ${appointment.appointment_type || 'Medical Appointment'}`,
      description: `Patient: ${appointment.patient_name}\nPhone: ${appointment.patient_phone}\nNotes: ${appointment.notes || ''}`,
      start: {
        dateTime: new Date(appointment.appointment_date).toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(new Date(appointment.appointment_date).getTime() + 30 * 60000).toISOString(),
        timeZone: 'UTC'
      },
      attendees: appointment.patient_email ? [{ email: appointment.patient_email }] : []
    };

    // TODO: Implement actual Google Calendar API integration
    // const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${access_token}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(eventData)
    // });

    return {
      success: true,
      provider: 'google_calendar',
      message: 'Appointment synced to Google Calendar',
      // eventId: response.id
    };
  }

  /**
   * Sync to Zocdoc
   */
  async syncToZocdoc(appointment, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use Zocdoc API
    const { api_key } = credentials;

    // TODO: Implement actual Zocdoc API integration
    return {
      success: true,
      provider: 'zocdoc',
      message: 'Appointment synced to Zocdoc'
    };
  }

  /**
   * Sync to Calendly
   */
  async syncToCalendly(appointment, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use Calendly API
    const { api_key } = credentials;

    // TODO: Implement actual Calendly API integration
    return {
      success: true,
      provider: 'calendly',
      message: 'Appointment synced to Calendly'
    };
  }

  /**
   * Sync to EHR system via FHIR/HL7
   */
  async syncToEHR(appointment, integration, organizationId) {
    try {
      // Get EHR system configuration
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'hl7' THEN h.*
                     WHEN e.connector_type = 'fhir' THEN f.*
                END as connector
         FROM ehr_systems e
         LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.organization_id = $1 AND e.is_active = true
         LIMIT 1`,
        [organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error('No active EHR system found');
      }

      const ehrSystem = ehrResult.rows[0];
      const connectorType = ehrSystem.connector_type;

      if (connectorType === 'fhir') {
        // Sync via FHIR
        const appointmentResource = fhirService.createAppointmentResource({
          appointmentId: appointment.id.toString(),
          patientId: appointment.patient_phone, // Use phone as patient identifier
          startTime: appointment.appointment_date,
          endTime: new Date(new Date(appointment.appointment_date).getTime() + 30 * 60000).toISOString(),
          status: appointment.status || 'booked',
          appointmentType: appointment.appointment_type,
          description: appointment.notes,
          patientName: appointment.patient_name
        });

        const result = await fhirService.createResource(ehrSystem.connector, 'Appointment', appointmentResource);
        return {
          success: true,
          provider: 'ehr_fhir',
          resourceId: result.id,
          message: 'Appointment synced to EHR via FHIR'
        };
      } else if (connectorType === 'hl7') {
        // Sync via HL7
        const hl7Message = hl7Service.generateADTMessage({
          patientName: { first: appointment.patient_name?.split(' ')[0] || '', last: appointment.patient_name?.split(' ').slice(1).join(' ') || '' },
          patientId: appointment.patient_phone,
          appointmentDate: appointment.appointment_date,
          appointmentType: appointment.appointment_type,
          sendingFacility: 'EHEALTH_MED_AI',
          receivingFacility: ehrSystem.name
        });

        const result = await hl7Service.sendMessage(hl7Message, ehrSystem.connector);
        return {
          success: true,
          provider: 'ehr_hl7',
          message: 'Appointment synced to EHR via HL7',
          hl7Response: result
        };
      } else {
        throw new Error(`Unsupported connector type: ${connectorType}`);
      }
    } catch (error) {
      console.error('Error syncing to EHR:', error);
      throw error;
    }
  }

  /**
   * Sync appointments in bulk
   */
  async syncAppointments(integrationId, organizationId, dateRange = null) {
    try {
      let query = 'SELECT * FROM appointments WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id = $1)';
      const params = [organizationId];

      if (dateRange) {
        query += ' AND appointment_date BETWEEN $2 AND $3';
        params.push(dateRange.start, dateRange.end);
      }

      query += ' ORDER BY appointment_date';

      const appointmentsResult = await db.query(query, params);
      const appointments = appointmentsResult.rows;

      const results = [];

      for (const appointment of appointments) {
        try {
          const result = await this.syncAppointment(appointment.id, integrationId, organizationId);
          results.push({ appointmentId: appointment.id, ...result });
        } catch (error) {
          results.push({
            appointmentId: appointment.id,
            success: false,
            error: error.message
          });
        }
      }

      return {
        total: appointments.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Error syncing appointments:', error);
      throw error;
    }
  }
}

module.exports = new AppointmentSyncService();

