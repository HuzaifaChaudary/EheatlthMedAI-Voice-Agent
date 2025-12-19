/**
 * EMR Medication History Service
 * Integrates with EHR/EMR systems to retrieve medication history
 * Supports: Epic, eClinicalWorks, Athena, Cerner, NextGen, AllScripts
 */

const db = require('../config/database');

class EMRMedicationService {
  /**
   * Get medication history from EMR for a patient
   */
  async getMedicationHistory(patientIdentifier, ehrSystemId, organizationId) {
    try {
      // Get EHR system configuration
      const ehrSystem = await this.getEHRSystem(ehrSystemId, organizationId);
      
      if (!ehrSystem) {
        throw new Error('EHR system not found or not configured');
      }

      // Route to appropriate EMR based on ehr_type
      switch (ehrSystem.ehr_type?.toLowerCase()) {
        case 'epic':
          return await this.getEpicMedications(patientIdentifier, ehrSystem);
        case 'eclinicalworks':
        case 'eclinical':
          return await this.getEClinicalWorksMedications(patientIdentifier, ehrSystem);
        case 'athena':
        case 'athenahealth':
          return await this.getAthenaMedications(patientIdentifier, ehrSystem);
        case 'cerner':
          return await this.getCernerMedications(patientIdentifier, ehrSystem);
        case 'nextgen':
          return await this.getNextGenMedications(patientIdentifier, ehrSystem);
        case 'allscripts':
          return await this.getAllScriptsMedications(patientIdentifier, ehrSystem);
        default:
          // Generic FHIR-based integration
          return await this.getFHIRMedications(patientIdentifier, ehrSystem);
      }
    } catch (error) {
      console.error('Error getting medication history from EMR:', error);
      // Return empty array instead of throwing - allows graceful degradation
      return [];
    }
  }

  /**
   * Get EHR system configuration
   */
  async getEHRSystem(ehrSystemId, organizationId) {
    try {
      const result = await db.query(
        `SELECT e.*, 
                CASE WHEN e.connector_type = 'fhir' THEN fc.api_endpoint 
                     WHEN e.connector_type = 'hl7' THEN hc.endpoint_url 
                     ELSE NULL END as api_endpoint,
                CASE WHEN e.connector_type = 'fhir' THEN fc.api_key 
                     WHEN e.connector_type = 'hl7' THEN hc.api_key 
                     ELSE NULL END as api_key,
                CASE WHEN e.connector_type = 'fhir' THEN fc.client_id 
                     ELSE NULL END as client_id,
                CASE WHEN e.connector_type = 'fhir' THEN fc.client_secret 
                     ELSE NULL END as client_secret
         FROM ehr_systems e
         LEFT JOIN fhir_connectors fc ON e.fhir_connector_id = fc.id AND e.connector_type = 'fhir'
         LEFT JOIN hl7_connectors hc ON e.hl7_connector_id = hc.id AND e.connector_type = 'hl7'
         WHERE e.id = $1 AND (e.organization_id = $2 OR e.organization_id IS NULL)`,
        [ehrSystemId, organizationId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting EHR system:', error);
      return null;
    }
  }

  /**
   * Get medications from Epic via FHIR
   */
  async getEpicMedications(patientIdentifier, ehrSystem) {
    // Epic uses FHIR MedicationRequest and MedicationStatement
    const fhirService = require('./fhirService');
    
    try {
      // Search for active medications
      const medicationRequests = await fhirService.searchResources(
        ehrSystem,
        'MedicationRequest',
        {
          patient: patientIdentifier,
          status: 'active'
        }
      );

      const medicationStatements = await fhirService.searchResources(
        ehrSystem,
        'MedicationStatement',
        {
          patient: patientIdentifier,
          status: 'active'
        }
      );

      // Combine and normalize medications
      const medications = [
        ...(medicationRequests.entry || []).map(e => this.normalizeFHIRMedication(e.resource, 'MedicationRequest')),
        ...(medicationStatements.entry || []).map(e => this.normalizeFHIRMedication(e.resource, 'MedicationStatement'))
      ];

      return this.deduplicateMedications(medications);
    } catch (error) {
      console.error('Error getting Epic medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Get medications from eClinicalWorks
   */
  async getEClinicalWorksMedications(patientIdentifier, ehrSystem) {
    // eClinicalWorks uses REST API
    try {
      const axios = require('axios');
      
      const response = await axios.get(
        `${ehrSystem.api_endpoint}/api/patient/${patientIdentifier}/medications`,
        {
          headers: {
            'Authorization': `Bearer ${ehrSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeEClinicalWorksMedications(response.data);
    } catch (error) {
      console.error('Error getting eClinicalWorks medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Get medications from Athena
   */
  async getAthenaMedications(patientIdentifier, ehrSystem) {
    // Athena uses REST API
    try {
      const axios = require('axios');
      
      const response = await axios.get(
        `${ehrSystem.api_endpoint}/v1/${ehrSystem.client_id}/patients/${patientIdentifier}/medications`,
        {
          headers: {
            'Authorization': `Bearer ${ehrSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeAthenaMedications(response.data);
    } catch (error) {
      console.error('Error getting Athena medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Get medications from Cerner via FHIR
   */
  async getCernerMedications(patientIdentifier, ehrSystem) {
    // Cerner uses FHIR
    return await this.getFHIRMedications(patientIdentifier, ehrSystem);
  }

  /**
   * Get medications from NextGen
   */
  async getNextGenMedications(patientIdentifier, ehrSystem) {
    // NextGen uses SOAP or REST API
    try {
      const axios = require('axios');
      
      const response = await axios.post(
        `${ehrSystem.api_endpoint}/api/medications`,
        {
          patientId: patientIdentifier,
          status: 'active'
        },
        {
          headers: {
            'Authorization': `Bearer ${ehrSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeNextGenMedications(response.data);
    } catch (error) {
      console.error('Error getting NextGen medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Get medications from AllScripts
   */
  async getAllScriptsMedications(patientIdentifier, ehrSystem) {
    // AllScripts uses REST API
    try {
      const axios = require('axios');
      
      const response = await axios.get(
        `${ehrSystem.api_endpoint}/api/v1/patients/${patientIdentifier}/medications`,
        {
          headers: {
            'Authorization': `Bearer ${ehrSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeAllScriptsMedications(response.data);
    } catch (error) {
      console.error('Error getting AllScripts medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Get medications via generic FHIR
   */
  async getFHIRMedications(patientIdentifier, ehrSystem) {
    const fhirService = require('./fhirService');
    
    try {
      const medicationRequests = await fhirService.searchResources(
        ehrSystem,
        'MedicationRequest',
        {
          patient: patientIdentifier,
          status: 'active'
        }
      );

      const medications = (medicationRequests.entry || []).map(e => 
        this.normalizeFHIRMedication(e.resource, 'MedicationRequest')
      );

      return medications;
    } catch (error) {
      console.error('Error getting FHIR medications:', error);
      // Return mock data for development/testing
      return this.getMockMedications(patientIdentifier);
    }
  }

  /**
   * Normalize FHIR Medication resource
   */
  normalizeFHIRMedication(fhirResource, resourceType) {
    const medication = fhirResource.medicationCodeableConcept || fhirResource.medicationReference;
    const medicationName = medication?.coding?.[0]?.display || medication?.display || 'Unknown Medication';
    
    const dosage = fhirResource.dosageInstruction?.[0] || {};
    const dosageText = dosage.text || 
      `${dosage.dose?.value || ''} ${dosage.dose?.unit || ''} ${dosage.route?.coding?.[0]?.display || ''}`;
    
    const frequency = dosage.timing?.repeat?.frequency || 1;
    const frequencyUnit = dosage.timing?.repeat?.periodUnit || 'day';
    
    return {
      medication_name: medicationName,
      dosage: dosageText.trim(),
      frequency: `${frequency} times per ${frequencyUnit}`,
      route: dosage.route?.coding?.[0]?.display || null,
      start_date: fhirResource.authoredOn || fhirResource.dateAsserted || null,
      end_date: fhirResource.effectivePeriod?.end || null,
      prescriber: fhirResource.requester?.display || null,
      status: fhirResource.status || 'active',
      source: 'emr',
      source_system: resourceType
    };
  }

  /**
   * Normalize eClinicalWorks medication format
   */
  normalizeEClinicalWorksMedications(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(med => ({
      medication_name: med.medicationName || med.name,
      dosage: med.dosage || med.strength,
      frequency: med.frequency || med.directions,
      route: med.route,
      start_date: med.startDate,
      end_date: med.endDate,
      prescriber: med.prescriberName,
      status: med.status || 'active',
      source: 'emr',
      source_system: 'eclinicalworks'
    }));
  }

  /**
   * Normalize Athena medication format
   */
  normalizeAthenaMedications(data) {
    if (!Array.isArray(data.medications)) return [];
    
    return data.medications.map(med => ({
      medication_name: med.name || med.medicationname,
      dosage: med.dosage || med.strength,
      frequency: med.frequency || med.frequencydescription,
      route: med.route,
      start_date: med.startdate,
      end_date: med.stopdate,
      prescriber: med.providername,
      status: med.status || 'active',
      source: 'emr',
      source_system: 'athena'
    }));
  }

  /**
   * Normalize NextGen medication format
   */
  normalizeNextGenMedications(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(med => ({
      medication_name: med.medicationName || med.name,
      dosage: med.dosage || med.dose,
      frequency: med.frequency || med.sig,
      route: med.route,
      start_date: med.startDate,
      end_date: med.endDate,
      prescriber: med.prescriber,
      status: med.status || 'active',
      source: 'emr',
      source_system: 'nextgen'
    }));
  }

  /**
   * Normalize AllScripts medication format
   */
  normalizeAllScriptsMedications(data) {
    if (!Array.isArray(data.medications)) return [];
    
    return data.medications.map(med => ({
      medication_name: med.medicationName || med.name,
      dosage: med.dosage || med.strength,
      frequency: med.frequency || med.directions,
      route: med.route,
      start_date: med.startDate,
      end_date: med.endDate,
      prescriber: med.prescriberName,
      status: med.status || 'active',
      source: 'emr',
      source_system: 'allscripts'
    }));
  }

  /**
   * Deduplicate medications (same medication may appear multiple times)
   */
  deduplicateMedications(medications) {
    const seen = new Set();
    return medications.filter(med => {
      const key = `${med.medication_name}-${med.dosage}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get mock medications for development/testing
   */
  getMockMedications(patientIdentifier) {
    // Return empty array in production - this is for development only
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    console.log('Using mock medication data for patient:', patientIdentifier);
    return [
      {
        medication_name: 'Lisinopril 10mg',
        dosage: '10mg',
        frequency: 'once daily',
        route: 'oral',
        start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: null,
        prescriber: 'Dr. Smith',
        status: 'active',
        source: 'emr',
        source_system: 'mock'
      },
      {
        medication_name: 'Metformin 500mg',
        dosage: '500mg',
        frequency: 'twice daily',
        route: 'oral',
        start_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: null,
        prescriber: 'Dr. Smith',
        status: 'active',
        source: 'emr',
        source_system: 'mock'
      }
    ];
  }

  /**
   * Check if medication exists in EMR for patient
   */
  async checkMedicationExists(patientIdentifier, medicationName, ehrSystemId, organizationId) {
    try {
      const medications = await this.getMedicationHistory(patientIdentifier, ehrSystemId, organizationId);
      const lowerMedName = medicationName.toLowerCase();
      
      return medications.some(med => 
        med.medication_name.toLowerCase().includes(lowerMedName) ||
        lowerMedName.includes(med.medication_name.toLowerCase())
      );
    } catch (error) {
      console.error('Error checking medication existence:', error);
      return false;
    }
  }
}

module.exports = new EMRMedicationService();

