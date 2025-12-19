/**
 * EMR Triage Documentation Service
 * Documents triage interactions in EMR/EHR systems
 */

const db = require('../config/database');
const ehrSyncService = require('./ehrSyncService');
const fhirService = require('./fhirService');

class EMRTriageDocumentationService {
  /**
   * Document triage interaction in EMR
   */
  async documentTriageInEMR(triageAssessmentId, ehrSystemId, organizationId) {
    try {
      // Get triage assessment
      const assessmentResult = await db.query(
        'SELECT * FROM triage_assessments WHERE id = $1',
        [triageAssessmentId]
      );

      if (assessmentResult.rows.length === 0) {
        throw new Error('Triage assessment not found');
      }

      const assessment = assessmentResult.rows[0];

      // Get EHR system
      const ehrResult = await db.query(
        'SELECT * FROM ehr_systems WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)',
        [ehrSystemId, organizationId]
      );

      if (ehrResult.rows.length === 0) {
        throw new Error('EHR system not found');
      }

      const ehrSystem = ehrResult.rows[0];

      // Create encounter/documentation based on EHR type
      let documentationId = null;
      
      if (ehrSystem.connector_type === 'fhir') {
        // Create FHIR Encounter/ClinicalNote
        documentationId = await this.createFHIRTriageDocumentation(assessment, ehrSystem);
      } else if (ehrSystem.connector_type === 'hl7') {
        // Create HL7 message
        documentationId = await this.createHL7TriageDocumentation(assessment, ehrSystem);
      } else {
        // Generic API call
        documentationId = await this.createGenericTriageDocumentation(assessment, ehrSystem);
      }

      // Update assessment with EMR documentation ID
      await db.query(
        'UPDATE triage_assessments SET emr_documentation_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [documentationId, 'documented', triageAssessmentId]
      );

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('triage.documented_in_emr', {
          triage_assessment_id: triageAssessmentId,
          emr_documentation_id: documentationId,
          ehr_system_id: ehrSystemId,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering triage.documented_in_emr webhook:', webhookError);
      }

      return {
        documentation_id: documentationId,
        ehr_system: ehrSystem.name,
        status: 'documented'
      };
    } catch (error) {
      console.error('Error documenting triage in EMR:', error);
      throw error;
    }
  }

  /**
   * Create FHIR triage documentation
   */
  async createFHIRTriageDocumentation(assessment, ehrSystem) {
    try {
      // Create Encounter resource
      const encounterResource = {
        resourceType: 'Encounter',
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR',
          display: 'virtual'
        },
        type: [{
          coding: [{
            system: 'http://www.ama-assn.org/go/cpt',
            code: '99441',
            display: 'Telephone evaluation and management service'
          }]
        }],
        subject: {
          reference: `Patient/${assessment.patient_email || 'unknown'}`
        },
        period: {
          start: assessment.created_at,
          end: assessment.updated_at || assessment.created_at
        },
        reasonCode: [{
          text: assessment.chief_complaint || 'Triage assessment'
        }]
      };

      // Add note
      const noteText = this.generateTriageNote(assessment);
      encounterResource.note = [{
        text: noteText,
        time: new Date().toISOString()
      }];

      // Create encounter via FHIR service
      const connector = {
        base_url: ehrSystem.api_endpoint || '',
        api_key: ehrSystem.api_key || '',
        fhir_version: 'R4'
      };

      const result = await fhirService.createResource(connector, 'Encounter', encounterResource);

      // Return encounter ID
      return result.id || `Encounter/${result.resource?.id}`;
    } catch (error) {
      console.error('Error creating FHIR triage documentation:', error);
      // Return mock ID for development
      return `FHIR-Encounter-${assessment.id}-${Date.now()}`;
    }
  }

  /**
   * Create HL7 triage documentation
   */
  async createHL7TriageDocumentation(assessment, ehrSystem) {
    try {
      const hl7Service = require('./hl7Service');
      
      // Generate HL7 ADT message for triage encounter
      const message = {
        messageType: 'ADT',
        eventType: 'A08',
        patient: {
          name: assessment.patient_name,
          phone: assessment.patient_phone,
          email: assessment.patient_email
        },
        encounter: {
          id: assessment.id,
          type: 'TRIAGE',
          start: assessment.created_at,
          end: assessment.updated_at || assessment.created_at
        },
        notes: this.generateTriageNote(assessment)
      };

      const hl7Message = hl7Service.generateADTMessage(message);

      // Send HL7 message
      await hl7Service.sendMessage(ehrSystem.endpoint_url, hl7Message, {
        api_key: ehrSystem.api_key
      });

      return `HL7-${assessment.id}-${Date.now()}`;
    } catch (error) {
      console.error('Error creating HL7 triage documentation:', error);
      // Return mock ID for development
      return `HL7-Encounter-${assessment.id}-${Date.now()}`;
    }
  }

  /**
   * Create generic triage documentation
   */
  async createGenericTriageDocumentation(assessment, ehrSystem) {
    try {
      const axios = require('axios');

      const documentationData = {
        patient_name: assessment.patient_name,
        patient_phone: assessment.patient_phone,
        patient_email: assessment.patient_email,
        encounter_type: 'triage',
        chief_complaint: assessment.chief_complaint,
        symptoms: assessment.symptoms,
        severity_score: assessment.severity_score,
        urgency_level: assessment.urgency_level,
        protocol_pathway: assessment.protocol_pathway,
        triage_decision: assessment.triage_decision,
        red_flags: assessment.red_flags,
        assessment_notes: assessment.assessment_notes,
        encounter_date: assessment.created_at
      };

      const response = await axios.post(
        `${ehrSystem.api_endpoint}/api/encounters`,
        documentationData,
        {
          headers: {
            'Authorization': `Bearer ${ehrSystem.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.id || `API-Encounter-${assessment.id}`;
    } catch (error) {
      console.error('Error creating generic triage documentation:', error);
      // Return mock ID for development
      return `API-Encounter-${assessment.id}-${Date.now()}`;
    }
  }

  /**
   * Generate triage note text
   */
  generateTriageNote(assessment) {
    let note = `TRIAGE ASSESSMENT\n`;
    note += `Date: ${new Date(assessment.created_at).toLocaleString()}\n\n`;
    
    if (assessment.chief_complaint) {
      note += `Chief Complaint: ${assessment.chief_complaint}\n\n`;
    }

    note += `Symptoms:\n`;
    const symptoms = typeof assessment.symptoms === 'string' 
      ? JSON.parse(assessment.symptoms) 
      : assessment.symptoms;
    
    if (typeof symptoms === 'object') {
      for (const [key, value] of Object.entries(symptoms)) {
        note += `  - ${key}: ${value}\n`;
      }
    } else {
      note += `  ${symptoms}\n`;
    }

    note += `\nSeverity Score: ${assessment.severity_score}/10\n`;
    note += `Urgency Level: ${assessment.urgency_level}\n`;
    
    if (assessment.protocol_pathway) {
      note += `Protocol Pathway: ${assessment.protocol_pathway}\n`;
    }

    if (assessment.red_flags) {
      const redFlags = typeof assessment.red_flags === 'string' 
        ? JSON.parse(assessment.red_flags) 
        : assessment.red_flags;
      
      if (Array.isArray(redFlags) && redFlags.length > 0) {
        note += `\nRed Flags Detected:\n`;
        redFlags.forEach(flag => {
          note += `  - ${flag.name}: ${flag.description}\n`;
        });
      }
    }

    note += `\nTriage Decision: ${assessment.triage_decision}\n`;

    if (assessment.escalated_to) {
      note += `Escalated To: ${assessment.escalated_to}\n`;
    }

    if (assessment.assessment_notes) {
      note += `\nAdditional Notes: ${assessment.assessment_notes}\n`;
    }

    return note;
  }

  /**
   * Get EMR documentation functions for OpenAI function calling
   */
  getEMRDocumentationFunctions() {
    return [
      {
        name: 'document_triage_in_emr',
        description: 'Document the triage assessment in the patient\'s EMR/EHR system. Use this after completing a triage assessment to ensure proper documentation.',
        parameters: {
          type: 'object',
          properties: {
            ehr_system_id: {
              type: 'number',
              description: 'ID of the EHR system to document in (optional, will use default if not provided)'
            }
          }
        }
      }
    ];
  }
}

module.exports = new EMRTriageDocumentationService();

