/**
 * Emergency Services Integration Service
 * Handles integration with emergency services (911) for critical cases
 */

const db = require('../config/database');

class EmergencyServicesService {
  /**
   * Call emergency services for critical triage case
   */
  async callEmergencyServices(triageAssessmentId, emergencyData, organizationId) {
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

      const {
        patient_location,
        emergency_type,
        additional_info
      } = emergencyData;

      // Determine emergency type if not provided
      const detectedEmergencyType = emergency_type || this.determineEmergencyType(assessment);

      // Create emergency service call record
      const result = await db.query(
        `INSERT INTO emergency_service_calls (
          triage_assessment_id, organization_id, patient_name, patient_phone,
          patient_location, emergency_type, severity_level, service_called, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          triageAssessmentId,
          organizationId,
          assessment.patient_name,
          assessment.patient_phone,
          patient_location || 'Location not provided',
          detectedEmergencyType,
          assessment.urgency_level,
          '911',
          additional_info || null
        ]
      );

      const emergencyCall = result.rows[0];

      // In a real implementation, this would:
      // 1. Call emergency services API (e.g., Twilio Emergency, or direct 911 routing)
      // 2. Log the call reference
      // 3. Send notifications
      
      // For now, we'll log it and return instructions
      console.log('EMERGENCY SERVICES CALL INITIATED:', {
        assessment_id: triageAssessmentId,
        patient: assessment.patient_name,
        phone: assessment.patient_phone,
        location: patient_location,
        emergency_type: detectedEmergencyType,
        urgency: assessment.urgency_level
      });

      // Update assessment status
      await db.query(
        'UPDATE triage_assessments SET status = $1, escalated_to = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['escalated', '911', triageAssessmentId]
      );

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('triage.emergency_called', {
          emergency_call_id: emergencyCall.id,
          triage_assessment_id: triageAssessmentId,
          patient_name: assessment.patient_name,
          emergency_type: detectedEmergencyType,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering triage.emergency_called webhook:', webhookError);
      }

      return {
        emergency_call: emergencyCall,
        message: this.getEmergencyCallMessage(detectedEmergencyType, patient_location)
      };
    } catch (error) {
      console.error('Error calling emergency services:', error);
      throw error;
    }
  }

  /**
   * Determine emergency type from assessment
   */
  determineEmergencyType(assessment) {
    const protocolPathway = assessment.protocol_pathway?.toLowerCase() || '';
    const symptoms = JSON.stringify(assessment.symptoms || {}).toLowerCase();
    const chiefComplaint = (assessment.chief_complaint || '').toLowerCase();

    const combinedText = `${protocolPathway} ${symptoms} ${chiefComplaint}`;

    if (combinedText.includes('chest pain') || combinedText.includes('heart')) {
      return 'cardiac_emergency';
    } else if (combinedText.includes('breathing') || combinedText.includes('respiratory')) {
      return 'respiratory_emergency';
    } else if (combinedText.includes('stroke') || combinedText.includes('neurological')) {
      return 'stroke';
    } else if (combinedText.includes('trauma') || combinedText.includes('injury')) {
      return 'severe_trauma';
    } else if (combinedText.includes('seizure')) {
      return 'seizure';
    } else if (combinedText.includes('bleeding') || combinedText.includes('hemorrhage')) {
      return 'severe_bleeding';
    } else if (combinedText.includes('overdose') || combinedText.includes('poisoning')) {
      return 'overdose_poisoning';
    } else if (combinedText.includes('unconscious') || combinedText.includes('unresponsive')) {
      return 'unresponsive_patient';
    } else {
      return 'medical_emergency';
    }
  }

  /**
   * Get emergency call message
   */
  getEmergencyCallMessage(emergencyType, location) {
    const locationText = location ? ` at ${location}` : '';
    
    const messages = {
      cardiac_emergency: `EMERGENCY: Based on your symptoms, you may be experiencing a cardiac event. Please call 911 immediately${locationText}. Stay calm and follow emergency operator instructions.`,
      respiratory_emergency: `EMERGENCY: Your breathing difficulties require immediate medical attention. Please call 911 immediately${locationText}.`,
      stroke: `EMERGENCY: You may be experiencing stroke symptoms. Please call 911 immediately${locationText}. Time is critical for stroke treatment.`,
      severe_trauma: `EMERGENCY: Your injury requires immediate medical attention. Please call 911 immediately${locationText}.`,
      seizure: `EMERGENCY: If you are experiencing a seizure, please call 911 immediately${locationText}. If someone else is with you, have them call for help.`,
      severe_bleeding: `EMERGENCY: Severe bleeding requires immediate attention. Please call 911 immediately${locationText} and apply pressure to the wound if possible.`,
      overdose_poisoning: `EMERGENCY: Possible overdose or poisoning requires immediate medical attention. Please call 911 immediately${locationText}. If you have the substance, bring it with you.`,
      unresponsive_patient: `EMERGENCY: Unresponsive patient requires immediate medical attention. Please call 911 immediately${locationText}.`,
      medical_emergency: `EMERGENCY: Your symptoms require immediate medical attention. Please call 911 immediately${locationText}.`
    };

    return messages[emergencyType] || messages.medical_emergency;
  }

  /**
   * Get emergency services functions for OpenAI function calling
   */
  getEmergencyFunctions() {
    return [
      {
        name: 'call_emergency_services',
        description: 'Call emergency services (911) for critical or emergent medical situations. Use this ONLY when symptoms indicate immediate life-threatening conditions like chest pain, difficulty breathing, stroke symptoms, severe bleeding, unconsciousness, etc.',
        parameters: {
          type: 'object',
          properties: {
            patient_location: {
              type: 'string',
              description: 'Patient current location or address for emergency services'
            },
            emergency_type: {
              type: 'string',
              description: 'Type of emergency (cardiac_emergency, respiratory_emergency, stroke, etc.)'
            },
            additional_info: {
              type: 'string',
              description: 'Any additional information for emergency services'
            }
          }
        }
      }
    ];
  }
}

module.exports = new EmergencyServicesService();

