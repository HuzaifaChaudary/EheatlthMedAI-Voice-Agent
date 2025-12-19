/**
 * Lab Systems Results Retrieval Service
 * Integrates with lab systems to retrieve lab results
 * Supports: Quest Diagnostics, LabCorp, Mayo Clinic Labs, Epic Beaker, Cerner PowerChart
 */

const db = require('../config/database');

class LabSystemsService {
  /**
   * Get lab results from lab system for a patient
   */
  async getLabResults(patientIdentifier, labSystemId, organizationId, dateRange = null) {
    try {
      // Get lab system configuration
      const labSystem = await this.getLabSystem(labSystemId, organizationId);
      
      if (!labSystem) {
        throw new Error('Lab system not found or not configured');
      }

      // Route to appropriate lab system based on ehr_type
      switch (labSystem.ehr_type?.toLowerCase()) {
        case 'quest':
        case 'quest diagnostics':
          return await this.getQuestResults(patientIdentifier, labSystem, dateRange);
        case 'labcorp':
          return await this.getLabCorpResults(patientIdentifier, labSystem, dateRange);
        case 'mayo':
        case 'mayo clinic':
          return await this.getMayoClinicResults(patientIdentifier, labSystem, dateRange);
        case 'epic beaker':
        case 'beaker':
          return await this.getEpicBeakerResults(patientIdentifier, labSystem, dateRange);
        case 'cerner powerchart':
        case 'powerchart':
          return await this.getCernerPowerChartResults(patientIdentifier, labSystem, dateRange);
        default:
          // Generic HL7/FHIR-based integration
          return await this.getFHIRLabResults(patientIdentifier, labSystem, dateRange);
      }
    } catch (error) {
      console.error('Error getting lab results from lab system:', error);
      // Return empty array instead of throwing - allows graceful degradation
      return [];
    }
  }

  /**
   * Get lab system configuration (using EHR systems table with lab type)
   */
  async getLabSystem(labSystemId, organizationId) {
    try {
      // Lab systems are stored in ehr_systems table with type='lab'
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
         WHERE e.id = $1 AND (e.organization_id = $2 OR e.organization_id IS NULL) AND e.ehr_type = 'lab'`,
        [labSystemId, organizationId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting lab system:', error);
      return null;
    }
  }

  /**
   * Get lab results from Quest Diagnostics
   */
  async getQuestResults(patientIdentifier, labSystem, dateRange) {
    try {
      const axios = require('axios');
      
      const params = {
        patientId: patientIdentifier
      };

      if (dateRange) {
        if (dateRange.start) params.startDate = dateRange.start;
        if (dateRange.end) params.endDate = dateRange.end;
      }

      const response = await axios.get(
        `${labSystem.api_endpoint}/api/v1/results`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${labSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeQuestResults(response.data);
    } catch (error) {
      console.error('Error getting Quest results:', error);
      // Return mock data for development/testing
      return this.getMockLabResults(patientIdentifier);
    }
  }

  /**
   * Get lab results from LabCorp
   */
  async getLabCorpResults(patientIdentifier, labSystem, dateRange) {
    try {
      const axios = require('axios');
      
      const params = {
        patientIdentifier: patientIdentifier
      };

      if (dateRange) {
        if (dateRange.start) params.fromDate = dateRange.start;
        if (dateRange.end) params.toDate = dateRange.end;
      }

      const response = await axios.get(
        `${labSystem.api_endpoint}/api/patients/${patientIdentifier}/results`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${labSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeLabCorpResults(response.data);
    } catch (error) {
      console.error('Error getting LabCorp results:', error);
      // Return mock data for development/testing
      return this.getMockLabResults(patientIdentifier);
    }
  }

  /**
   * Get lab results from Mayo Clinic Labs
   */
  async getMayoClinicResults(patientIdentifier, labSystem, dateRange) {
    try {
      const axios = require('axios');
      
      const requestBody = {
        patientId: patientIdentifier
      };

      if (dateRange) {
        requestBody.dateRange = dateRange;
      }

      const response = await axios.post(
        `${labSystem.api_endpoint}/api/lab-results/query`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${labSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.normalizeMayoClinicResults(response.data);
    } catch (error) {
      console.error('Error getting Mayo Clinic results:', error);
      // Return mock data for development/testing
      return this.getMockLabResults(patientIdentifier);
    }
  }

  /**
   * Get lab results from Epic Beaker (FHIR)
   */
  async getEpicBeakerResults(patientIdentifier, labSystem, dateRange) {
    // Epic Beaker uses FHIR DiagnosticReport
    return await this.getFHIRLabResults(patientIdentifier, labSystem, dateRange);
  }

  /**
   * Get lab results from Cerner PowerChart (FHIR)
   */
  async getCernerPowerChartResults(patientIdentifier, labSystem, dateRange) {
    // Cerner PowerChart uses FHIR
    return await this.getFHIRLabResults(patientIdentifier, labSystem, dateRange);
  }

  /**
   * Get lab results via generic FHIR
   */
  async getFHIRLabResults(patientIdentifier, labSystem, dateRange) {
    const fhirService = require('./fhirService');
    
    try {
      const searchParams = {
        subject: `Patient/${patientIdentifier}`,
        status: 'final'
      };

      if (dateRange) {
        if (dateRange.start) searchParams.date = `ge${dateRange.start}`;
        if (dateRange.end) {
          const endDate = searchParams.date ? `&date=le${dateRange.end}` : `date=le${dateRange.end}`;
          searchParams.date = searchParams.date ? `${searchParams.date}&${endDate}` : endDate;
        }
      }

      const diagnosticReports = await fhirService.searchResources(
        labSystem,
        'DiagnosticReport',
        searchParams
      );

      const results = (diagnosticReports.entry || []).map(e => 
        this.normalizeFHIRLabResult(e.resource)
      );

      return results;
    } catch (error) {
      console.error('Error getting FHIR lab results:', error);
      // Return mock data for development/testing
      return this.getMockLabResults(patientIdentifier);
    }
  }

  /**
   * Normalize FHIR DiagnosticReport to lab result format
   */
  normalizeFHIRLabResult(fhirResource) {
    const code = fhirResource.code?.coding?.[0];
    const testName = code?.display || code?.code || 'Unknown Test';
    
    // Extract results from result field (array of Observation references or embedded Observations)
    const results = [];
    if (fhirResource.result && Array.isArray(fhirResource.result)) {
      fhirResource.result.forEach(ref => {
        if (ref.reference) {
          // This is a reference, would need to fetch separately
          // For now, we'll extract from contained resources if available
        } else if (ref.valueQuantity) {
          results.push({
            test_name: testName,
            result_value: ref.valueQuantity.value,
            unit: ref.valueQuantity.unit,
            reference_range: ref.referenceRange?.[0]
          });
        }
      });
    }

    // If no results extracted, use code and effectiveDateTime
    if (results.length === 0) {
      return {
        test_name: testName,
        test_type: fhirResource.category?.[0]?.coding?.[0]?.display || 'laboratory',
        result_value: null,
        unit: null,
        normal_range_min: null,
        normal_range_max: null,
        normal_range_text: null,
        status: fhirResource.status || 'final',
        test_date: fhirResource.effectiveDateTime || fhirResource.issued,
        ordering_provider: fhirResource.performer?.[0]?.display || null,
        source: 'lab_system',
        source_system: 'fhir'
      };
    }

    // Return first result (most common case)
    const result = results[0];
    const refRange = result.reference_range || {};
    
    return {
      test_name: result.test_name || testName,
      test_type: fhirResource.category?.[0]?.coding?.[0]?.display || 'laboratory',
      result_value: result.result_value?.toString(),
      unit: result.unit,
      normal_range_min: refRange.low?.value || null,
      normal_range_max: refRange.high?.value || null,
      normal_range_text: refRange.text || 
        (refRange.low && refRange.high ? `${refRange.low.value}-${refRange.high.value} ${refRange.high.unit || ''}`.trim() : null),
      status: fhirResource.status || 'final',
      test_date: fhirResource.effectiveDateTime || fhirResource.issued,
      ordering_provider: fhirResource.performer?.[0]?.display || null,
      source: 'lab_system',
      source_system: 'fhir'
    };
  }

  /**
   * Normalize Quest Diagnostics result format
   */
  normalizeQuestResults(data) {
    if (!Array.isArray(data.results)) return [];
    
    return data.results.map(result => ({
      test_name: result.testName || result.name,
      test_type: result.testType || 'laboratory',
      result_value: result.value?.toString(),
      unit: result.unit,
      normal_range_min: result.normalRange?.min,
      normal_range_max: result.normalRange?.max,
      normal_range_text: result.normalRange?.text || result.referenceRange,
      status: result.status || 'final',
      test_date: result.testDate || result.collectedDate,
      ordering_provider: result.orderingProvider,
      source: 'lab_system',
      source_system: 'quest'
    }));
  }

  /**
   * Normalize LabCorp result format
   */
  normalizeLabCorpResults(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(result => ({
      test_name: result.testName || result.name,
      test_type: result.testType || 'laboratory',
      result_value: result.resultValue?.toString(),
      unit: result.unit,
      normal_range_min: result.referenceLow,
      normal_range_max: result.referenceHigh,
      normal_range_text: result.referenceRange,
      status: result.status || 'final',
      test_date: result.testDate || result.collectedDate,
      ordering_provider: result.orderingProvider,
      source: 'lab_system',
      source_system: 'labcorp'
    }));
  }

  /**
   * Normalize Mayo Clinic result format
   */
  normalizeMayoClinicResults(data) {
    if (!Array.isArray(data.results)) return [];
    
    return data.results.map(result => ({
      test_name: result.testName || result.name,
      test_type: result.testType || 'laboratory',
      result_value: result.value?.toString(),
      unit: result.unit,
      normal_range_min: result.normalLow,
      normal_range_max: result.normalHigh,
      normal_range_text: result.normalRange,
      status: result.status || 'final',
      test_date: result.testDate,
      ordering_provider: result.orderingPhysician,
      source: 'lab_system',
      source_system: 'mayo_clinic'
    }));
  }

  /**
   * Get mock lab results for development/testing
   */
  getMockLabResults(patientIdentifier) {
    // Return empty array in production - this is for development only
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    console.log('Using mock lab result data for patient:', patientIdentifier);
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return [
      {
        test_name: 'Glucose',
        test_type: 'blood',
        result_value: '95',
        unit: 'mg/dL',
        normal_range_min: 70,
        normal_range_max: 100,
        normal_range_text: '70-100 mg/dL',
        status: 'final',
        test_date: lastWeek.toISOString().split('T')[0],
        ordering_provider: 'Dr. Smith',
        source: 'lab_system',
        source_system: 'mock'
      },
      {
        test_name: 'Hemoglobin A1C',
        test_type: 'blood',
        result_value: '5.2',
        unit: '%',
        normal_range_min: 4.0,
        normal_range_max: 5.6,
        normal_range_text: '4.0-5.6%',
        status: 'final',
        test_date: lastMonth.toISOString().split('T')[0],
        ordering_provider: 'Dr. Smith',
        source: 'lab_system',
        source_system: 'mock'
      }
    ];
  }

  /**
   * Get specific lab result by test name
   */
  async getLabResultByTestName(patientIdentifier, testName, labSystemId, organizationId) {
    try {
      const allResults = await this.getLabResults(patientIdentifier, labSystemId, organizationId);
      const lowerTestName = testName.toLowerCase();
      
      return allResults.find(result => 
        result.test_name.toLowerCase().includes(lowerTestName) ||
        lowerTestName.includes(result.test_name.toLowerCase())
      );
    } catch (error) {
      console.error('Error getting lab result by test name:', error);
      return null;
    }
  }
}

module.exports = new LabSystemsService();

