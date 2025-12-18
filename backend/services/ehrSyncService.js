/**
 * EHR Data Synchronization Service
 * Handles two-way data synchronization with EHR systems via FHIR/HL7
 */

const db = require('../config/database');
const fhirService = require('./fhirService');
const hl7Service = require('./hl7Service');
const webhookService = require('./webhookService');

class EHRSyncService {
  /**
   * Sync patient data to EHR system
   */
  async syncPatientToEHR(patientData, ehrSystemId, organizationId) {
    try {
      // Get EHR system configuration
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'hl7' THEN row_to_json(h.*)
                     WHEN e.connector_type = 'fhir' THEN row_to_json(f.*)
                END as connector_data
         FROM ehr_systems e
         LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.id = $1 AND e.organization_id = $2 AND e.is_active = true`,
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }

      const ehrSystem = ehrResult.rows[0];
      const connectorType = ehrSystem.connector_type;

      let result;

      if (connectorType === 'fhir') {
        // Sync via FHIR
        const connector = typeof ehrSystem.connector_data === 'string' 
          ? JSON.parse(ehrSystem.connector_data) 
          : ehrSystem.connector_data;

        const patientResource = fhirService.createPatientResource(patientData);
        
        // Try to find existing patient first
        if (patientData.patientId) {
          const existingPatient = await fhirService.getResource(connector, 'Patient', patientData.patientId);
          if (existingPatient.success) {
            // Update existing patient
            result = await fhirService.updateResource(connector, 'Patient', patientData.patientId, patientResource);
            result.action = 'updated';
          } else {
            // Create new patient
            result = await fhirService.createResource(connector, 'Patient', patientResource);
            result.action = 'created';
          }
        } else {
          // Create new patient
          result = await fhirService.createResource(connector, 'Patient', patientResource);
          result.action = 'created';
        }
      } else if (connectorType === 'hl7') {
        // Sync via HL7 ADT message
        const connector = typeof ehrSystem.connector_data === 'string' 
          ? JSON.parse(ehrSystem.connector_data) 
          : ehrSystem.connector_data;

        const hl7Message = hl7Service.generateADTMessage({
          patientName: patientData.name,
          patientId: patientData.patientId,
          dob: patientData.dob,
          gender: patientData.gender,
          sendingFacility: 'EHEALTH_MED_AI',
          receivingFacility: ehrSystem.name
        });

        const sendResult = await hl7Service.sendMessage(hl7Message, connector);
        result = {
          success: true,
          action: 'sent',
          ...sendResult
        };
      } else {
        throw new Error(`Unsupported connector type: ${connectorType}`);
      }

      // Update EHR system last_sync_at
      await db.query(
        'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ehrSystemId]
      );

      // Trigger webhook event
      await webhookService.deliverWebhookEvent('ehr.patient.synced', {
        ehr_system_id: ehrSystemId,
        patient_id: patientData.patientId,
        action: result.action,
        result
      }, organizationId);

      return result;
    } catch (error) {
      console.error('Error syncing patient to EHR:', error);
      throw error;
    }
  }

  /**
   * Sync appointment data to EHR system
   */
  async syncAppointmentToEHR(appointmentData, ehrSystemId, organizationId) {
    try {
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'fhir' THEN row_to_json(f.*)
                END as connector_data
         FROM ehr_systems e
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.id = $1 AND e.organization_id = $2 AND e.is_active = true`,
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }

      const ehrSystem = ehrResult.rows[0];

      if (ehrSystem.connector_type !== 'fhir') {
        throw new Error('Appointment sync currently only supports FHIR');
      }

      const connector = typeof ehrSystem.connector_data === 'string' 
        ? JSON.parse(ehrSystem.connector_data) 
        : ehrSystem.connector_data;

      const appointmentResource = fhirService.createAppointmentResource(appointmentData);
      const result = await fhirService.createResource(connector, 'Appointment', appointmentResource);

      await db.query(
        'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ehrSystemId]
      );

      return result;
    } catch (error) {
      console.error('Error syncing appointment to EHR:', error);
      throw error;
    }
  }

  /**
   * Sync encounter data to EHR system
   */
  async syncEncounterToEHR(encounterData, ehrSystemId, organizationId) {
    try {
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'fhir' THEN row_to_json(f.*)
                END as connector_data
         FROM ehr_systems e
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.id = $1 AND e.organization_id = $2 AND e.is_active = true`,
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }

      const ehrSystem = ehrResult.rows[0];

      if (ehrSystem.connector_type !== 'fhir') {
        throw new Error('Encounter sync currently only supports FHIR');
      }

      const connector = typeof ehrSystem.connector_data === 'string' 
        ? JSON.parse(ehrSystem.connector_data) 
        : ehrSystem.connector_data;

      const encounterResource = fhirService.createEncounterResource(encounterData);
      const result = await fhirService.createResource(connector, 'Encounter', encounterResource);

      await db.query(
        'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ehrSystemId]
      );

      return result;
    } catch (error) {
      console.error('Error syncing encounter to EHR:', error);
      throw error;
    }
  }

  /**
   * Pull patient data from EHR system (two-way sync)
   */
  async pullPatientFromEHR(patientId, ehrSystemId, organizationId) {
    try {
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'fhir' THEN row_to_json(f.*)
                END as connector_data
         FROM ehr_systems e
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.id = $1 AND e.organization_id = $2 AND e.is_active = true`,
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }

      const ehrSystem = ehrResult.rows[0];

      if (ehrSystem.connector_type !== 'fhir') {
        throw new Error('Patient pull currently only supports FHIR');
      }

      const connector = typeof ehrSystem.connector_data === 'string' 
        ? JSON.parse(ehrSystem.connector_data) 
        : ehrSystem.connector_data;

      const result = await fhirService.getResource(connector, 'Patient', patientId);

      if (result.success) {
        // Update local database with pulled patient data
        // TODO: Implement database update logic
        await db.query(
          'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
          [ehrSystemId]
        );

        await webhookService.deliverWebhookEvent('ehr.patient.pulled', {
          ehr_system_id: ehrSystemId,
          patient_id: patientId,
          result
        }, organizationId);
      }

      return result;
    } catch (error) {
      console.error('Error pulling patient from EHR:', error);
      throw error;
    }
  }

  /**
   * Pull appointments from EHR system
   */
  async pullAppointmentsFromEHR(ehrSystemId, organizationId, dateRange = null) {
    try {
      const ehrResult = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'fhir' THEN row_to_json(f.*)
                END as connector_data
         FROM ehr_systems e
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.id = $1 AND e.organization_id = $2 AND e.is_active = true`,
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }

      const ehrSystem = ehrResult.rows[0];

      if (ehrSystem.connector_type !== 'fhir') {
        throw new Error('Appointment pull currently only supports FHIR');
      }

      const connector = typeof ehrSystem.connector_data === 'string' 
        ? JSON.parse(ehrSystem.connector_data) 
        : ehrSystem.connector_data;

      const searchParams = {};
      if (dateRange) {
        searchParams.date = `ge${dateRange.start}`;
        if (dateRange.end) {
          searchParams._and = `date le${dateRange.end}`;
        }
      }

      const result = await fhirService.searchResources(connector, 'Appointment', searchParams);

      await db.query(
        'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ehrSystemId]
      );

      return result;
    } catch (error) {
      console.error('Error pulling appointments from EHR:', error);
      throw error;
    }
  }

  /**
   * Perform full synchronization (push and pull)
   */
  async fullSync(ehrSystemId, organizationId, options = {}) {
    try {
      const results = {
        patients: { pushed: 0, pulled: 0, errors: [] },
        appointments: { pushed: 0, pulled: 0, errors: [] },
        encounters: { pushed: 0, pulled: 0, errors: [] }
      };

      // TODO: Implement full sync logic based on sync_enabled and sync_frequency settings
      // This would push local data to EHR and pull remote data

      await db.query(
        'UPDATE ehr_systems SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ehrSystemId]
      );

      return results;
    } catch (error) {
      console.error('Error performing full sync:', error);
      throw error;
    }
  }
}

module.exports = new EHRSyncService();

