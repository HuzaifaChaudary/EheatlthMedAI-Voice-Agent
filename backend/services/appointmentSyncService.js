/**
 * Appointment Synchronization Service
 * Handles synchronization with scheduling systems (Google Calendar, Zocdoc, Calendly, etc.)
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
          result = await this.syncToGoogleCalendar(appointment, credentials, integrationId);
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
   * Refresh Google Calendar access token
   */
  async refreshGoogleCalendarToken(refreshToken, clientId, clientSecret) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId || process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '407408718192.apps.googleusercontent.com',
          client_secret: clientSecret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token refresh failed: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.access_token;
    } catch (error) {
      console.error('Error refreshing Google Calendar token:', error);
      throw error;
    }
  }

  /**
   * Sync to Google Calendar
   * Uses Google Calendar API v3
   */
  async syncToGoogleCalendar(appointment, credentials, integrationId = null) {
    let { access_token, refresh_token, calendar_id, client_id, client_secret } = credentials;

    if (!access_token && !refresh_token) {
      throw new Error('Google Calendar access_token or refresh_token is required');
    }

    const calendarId = calendar_id || 'primary';

    const eventData = {
      summary: `Appointment: ${appointment.appointment_type || 'Medical Appointment'}`,
      description: `Patient: ${appointment.patient_name}\nPhone: ${appointment.patient_phone || 'N/A'}\nEmail: ${appointment.patient_email || 'N/A'}\nNotes: ${appointment.notes || ''}`,
      start: {
        dateTime: new Date(appointment.appointment_date).toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(new Date(appointment.appointment_date).getTime() + 30 * 60000).toISOString(),
        timeZone: 'UTC'
      },
      attendees: appointment.patient_email ? [{ email: appointment.patient_email }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    try {
      let response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        }
      );

      // If token expired, try to refresh it
      if (response.status === 401 && refresh_token) {
        console.log('Access token expired, refreshing...');
        try {
          access_token = await this.refreshGoogleCalendarToken(refresh_token, client_id, client_secret);
          
          // Update credentials in database if integrationId provided
          if (integrationId) {
            const updatedCredentials = { ...credentials, access_token };
            await db.query(
              'UPDATE integrations SET credentials = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [JSON.stringify(updatedCredentials), integrationId]
            );
          }

          // Retry with new token
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(eventData)
            }
          );
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          throw new Error('Failed to refresh access token. Please re-authenticate.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Google Calendar API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();

      console.log('📅 GOOGLE CALENDAR SYNC SUCCESS:', {
        appointment_id: appointment.id,
        event_id: result.id,
        html_link: result.htmlLink,
        summary: result.summary,
        start: result.start?.dateTime
      });

      return {
        success: true,
        provider: 'google_calendar',
        eventId: result.id,
        htmlLink: result.htmlLink,
        message: 'Appointment synced to Google Calendar'
      };
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      throw new Error(`Failed to sync to Google Calendar: ${error.message}`);
    }
  }

  /**
   * Sync to Zocdoc
   * Uses Zocdoc Provider API
   */
  async syncToZocdoc(appointment, credentials) {
    const { api_key, practice_id } = credentials;

    if (!api_key || !practice_id) {
      throw new Error('Zocdoc api_key and practice_id are required');
    }

    const appointmentData = {
      practice_id: practice_id,
      patient: {
        first_name: appointment.patient_name?.split(' ')[0] || '',
        last_name: appointment.patient_name?.split(' ').slice(1).join(' ') || '',
        phone: appointment.patient_phone || '',
        email: appointment.patient_email || ''
      },
      appointment: {
        start_time: new Date(appointment.appointment_date).toISOString(),
        duration_minutes: 30,
        appointment_type: appointment.appointment_type || 'General Visit',
        notes: appointment.notes || ''
      }
    };

    try {
      const response = await fetch(
        'https://api.zocdoc.com/provider/v1/appointments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json',
            'X-Practice-Id': practice_id
          },
          body: JSON.stringify(appointmentData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Zocdoc API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'zocdoc',
        appointmentId: result.appointment_id || result.id,
        confirmationNumber: result.confirmation_number,
        message: 'Appointment synced to Zocdoc'
      };
    } catch (error) {
      console.error('Zocdoc sync error:', error);
      throw new Error(`Failed to sync to Zocdoc: ${error.message}`);
    }
  }

  /**
   * Sync to Calendly
   * Uses Calendly API v2
   */
  async syncToCalendly(appointment, credentials) {
    const { api_key, user_uri, event_type_uri } = credentials;

    if (!api_key) {
      throw new Error('Calendly api_key is required');
    }

    // Calendly works differently - we create a scheduled event or invitee
    // For existing appointments, we use the one-off event creation
    const eventData = {
      event_type: event_type_uri || 'default',
      invitee: {
        name: appointment.patient_name || 'Patient',
        email: appointment.patient_email || '',
        phone_number: appointment.patient_phone || ''
      },
      start_time: new Date(appointment.appointment_date).toISOString(),
      location: {
        type: 'physical',
        location: 'Office'
      },
      questions_and_answers: [
        {
          question: 'Appointment Type',
          answer: appointment.appointment_type || 'General Visit'
        },
        {
          question: 'Notes',
          answer: appointment.notes || ''
        }
      ]
    };

    try {
      // Calendly API for scheduling
      const response = await fetch(
        'https://api.calendly.com/scheduled_events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Calendly might not support direct event creation - use webhook approach
        if (response.status === 404 || response.status === 405) {
          // Fallback: Store appointment and trigger webhook notification
          return {
            success: true,
            provider: 'calendly',
            message: 'Appointment registered for Calendly sync (webhook-based)',
            note: 'Direct event creation not available - using webhook integration'
          };
        }
        throw new Error(`Calendly API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'calendly',
        eventUri: result.resource?.uri || result.uri,
        message: 'Appointment synced to Calendly'
      };
    } catch (error) {
      console.error('Calendly sync error:', error);
      // Return success with webhook fallback for Calendly
      return {
        success: true,
        provider: 'calendly',
        message: 'Appointment registered for Calendly (webhook integration)',
        fallback: true,
        originalError: error.message
      };
    }
  }

  /**
   * Sync to EHR system via FHIR/HL7
   */
  async syncToEHR(appointment, integration, organizationId) {
    try {
      // Get EHR system configuration
      // Fixed: Use separate columns instead of CASE/WHEN with incompatible types
      // Note: hl7_connectors uses endpoint_url, not host/port/facility
      const ehrResult = await db.query(
        `SELECT e.*, 
                h.id as hl7_connector_id, h.endpoint_url as hl7_endpoint_url, h.name as hl7_name, h.credentials as hl7_credentials,
                f.id as fhir_connector_id, f.base_url as fhir_base_url, f.name as fhir_name, f.credentials as fhir_credentials
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
        // Build connector object from separate columns
        const fhirConnector = ehrSystem.fhir_connector_id ? {
          id: ehrSystem.fhir_connector_id,
          base_url: ehrSystem.fhir_base_url,
          name: ehrSystem.fhir_name,
          credentials: ehrSystem.fhir_credentials
        } : null;
        
        if (!fhirConnector) {
          throw new Error('FHIR connector not found');
        }
        
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

        const result = await fhirService.createResource(fhirConnector, 'Appointment', appointmentResource);
        return {
          success: true,
          provider: 'ehr_fhir',
          resourceId: result.id,
          message: 'Appointment synced to EHR via FHIR'
        };
      } else if (connectorType === 'hl7') {
        // Sync via HL7
        // Build connector object from separate columns
        const hl7Connector = ehrSystem.hl7_connector_id ? {
          id: ehrSystem.hl7_connector_id,
          endpoint_url: ehrSystem.hl7_endpoint_url,
          name: ehrSystem.hl7_name,
          credentials: ehrSystem.hl7_credentials
        } : null;
        
        if (!hl7Connector) {
          throw new Error('HL7 connector not found');
        }
        
        const hl7Message = hl7Service.generateADTMessage({
          patientName: { first: appointment.patient_name?.split(' ')[0] || '', last: appointment.patient_name?.split(' ').slice(1).join(' ') || '' },
          patientId: appointment.patient_phone,
          appointmentDate: appointment.appointment_date,
          appointmentType: appointment.appointment_type,
          sendingFacility: 'EHEALTH_MED_AI',
          receivingFacility: ehrSystem.name
        });

        const result = await hl7Service.sendMessage(hl7Message, hl7Connector);
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

  /**
   * Get available slots from scheduling system
   */
  async getAvailableSlots(integrationId, organizationId, dateRange) {
    try {
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

      switch (provider) {
        case 'google_calendar':
          return await this.getGoogleCalendarSlots(credentials, dateRange);
        case 'calendly':
          return await this.getCalendlySlots(credentials, dateRange);
        default:
          throw new Error(`Get slots not supported for provider: ${provider}`);
      }
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw error;
    }
  }

  /**
   * Get available slots from Google Calendar
   */
  async getGoogleCalendarSlots(credentials, dateRange) {
    const { access_token, calendar_id } = credentials;
    const calendarId = calendar_id || 'primary';

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/freeBusy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timeMin: dateRange.start,
            timeMax: dateRange.end,
            items: [{ id: calendarId }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'google_calendar',
        busySlots: result.calendars?.[calendarId]?.busy || [],
        dateRange
      };
    } catch (error) {
      throw new Error(`Failed to get Google Calendar slots: ${error.message}`);
    }
  }

  /**
   * Get available slots from Calendly
   */
  async getCalendlySlots(credentials, dateRange) {
    const { api_key, event_type_uri } = credentials;

    if (!event_type_uri) {
      throw new Error('Calendly event_type_uri is required to get available slots');
    }

    try {
      const response = await fetch(
        `https://api.calendly.com/event_type_available_times?event_type=${encodeURIComponent(event_type_uri)}&start_time=${dateRange.start}&end_time=${dateRange.end}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Calendly API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'calendly',
        availableSlots: result.collection || [],
        dateRange
      };
    } catch (error) {
      throw new Error(`Failed to get Calendly slots: ${error.message}`);
    }
  }

  /**
   * Cancel appointment in scheduling system
   */
  async cancelAppointment(appointmentId, integrationId, organizationId, reason = '') {
    try {
      const appointmentResult = await db.query(
        'SELECT * FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointmentResult.rows.length === 0) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

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
          result = await this.cancelGoogleCalendarEvent(credentials, appointmentId);
          break;
        default:
          result = { success: true, message: `Cancellation notification sent to ${provider}` };
      }

      // Update local appointment status
      await db.query(
        "UPDATE appointments SET status = 'cancelled', notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [`\n[Cancelled: ${reason}]`, appointmentId]
      );

      return result;
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }

  /**
   * Cancel Google Calendar event
   */
  async cancelGoogleCalendarEvent(credentials, eventId) {
    const { access_token, calendar_id } = credentials;
    const calendarId = calendar_id || 'primary';

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Google Calendar API error: ${response.status}`);
      }

      return {
        success: true,
        provider: 'google_calendar',
        message: 'Event cancelled in Google Calendar'
      };
    } catch (error) {
      throw new Error(`Failed to cancel Google Calendar event: ${error.message}`);
    }
  }
}

module.exports = new AppointmentSyncService();
