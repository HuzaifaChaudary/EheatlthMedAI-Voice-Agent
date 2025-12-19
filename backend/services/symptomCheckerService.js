/**
 * Symptom Checker Service
 * Structured symptom checking workflow with severity assessment
 */

const db = require('../config/database');

class SymptomCheckerService {
  /**
   * Perform structured symptom assessment
   */
  async assessSymptoms(conversationId, assessmentData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        chief_complaint,
        symptoms,
        additional_info
      } = assessmentData;

      // Validate required fields
      if (!patient_name || !symptoms) {
        throw new Error('Patient name and symptoms are required');
      }

      // Parse symptoms if string
      const symptomsData = typeof symptoms === 'string' ? JSON.parse(symptoms) : symptoms;

      // Determine severity score
      const severityScore = this.calculateSeverityScore(symptomsData, chief_complaint);

      // Detect red flags
      const redFlags = await this.detectRedFlags(symptomsData, chief_complaint, organizationId);

      // Determine urgency level
      const urgencyLevel = this.determineUrgencyLevel(severityScore, redFlags);

      // Determine protocol pathway
      const protocolPathway = await this.determineProtocolPathway(symptomsData, chief_complaint, organizationId);

      // Get triage decision based on pathway
      const triageDecision = await this.getTriageDecision(protocolPathway, urgencyLevel, redFlags, organizationId);

      // Create triage assessment record
      const result = await db.query(
        `INSERT INTO triage_assessments (
          conversation_id, patient_name, patient_phone, patient_email,
          chief_complaint, symptoms, severity_score, urgency_level,
          protocol_pathway, triage_decision, red_flags, assessment_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          conversationId,
          patient_name,
          patient_phone || null,
          patient_email || null,
          chief_complaint || null,
          JSON.stringify(symptomsData),
          severityScore,
          urgencyLevel,
          protocolPathway || null,
          triageDecision.decision,
          JSON.stringify(redFlags),
          additional_info || null
        ]
      );

      const assessment = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('triage.assessment_completed', {
          assessment_id: assessment.id,
          conversation_id: conversationId,
          urgency_level: urgencyLevel,
          protocol_pathway: protocolPathway,
          red_flags_detected: redFlags.length,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering triage.assessment_completed webhook:', webhookError);
      }

      return {
        assessment: assessment,
        severity_score: severityScore,
        urgency_level: urgencyLevel,
        red_flags: redFlags,
        recommendation: triageDecision
      };
    } catch (error) {
      console.error('Error assessing symptoms:', error);
      throw error;
    }
  }

  /**
   * Calculate severity score (1-10) based on symptoms
   */
  calculateSeverityScore(symptoms, chiefComplaint) {
    let score = 5; // Default moderate severity

    const symptomText = `${chiefComplaint || ''} ${JSON.stringify(symptoms)}`.toLowerCase();

    // Critical indicators (9-10)
    if (this.containsKeywords(symptomText, ['unconscious', 'not breathing', 'severe chest pain', 'severe difficulty breathing', 'stroke', 'seizure', 'severe bleeding'])) {
      score = 10;
    } else if (this.containsKeywords(symptomText, ['chest pain', 'difficulty breathing', 'severe pain', 'cannot move', 'numbness', 'confusion'])) {
      score = 9;
    }
    // High severity (7-8)
    else if (this.containsKeywords(symptomText, ['high fever', 'vomiting blood', 'severe headache', 'rapid heartbeat', 'dizziness', 'fainting'])) {
      score = 8;
    } else if (this.containsKeywords(symptomText, ['moderate pain', 'fever', 'nausea', 'shortness of breath', 'persistent cough'])) {
      score = 7;
    }
    // Moderate severity (5-6)
    else if (this.containsKeywords(symptomText, ['mild pain', 'minor injury', 'rash', 'cough', 'sore throat'])) {
      score = 6;
    } else if (this.containsKeywords(symptomText, ['tired', 'mild discomfort', 'itchy', 'runny nose'])) {
      score = 5;
    }
    // Low severity (1-4)
    else if (this.containsKeywords(symptomText, ['minor', 'slight', 'mild'])) {
      score = 3;
    } else {
      score = 5; // Default
    }

    // Adjust based on duration if provided
    if (symptoms.duration) {
      const duration = symptoms.duration.toLowerCase();
      if (duration.includes('minutes') || duration.includes('hour')) {
        score += 1; // Recent onset may be more urgent
      } else if (duration.includes('day') || duration.includes('week')) {
        score -= 1; // Long duration may be less urgent (unless chronic)
      }
    }

    // Clamp between 1-10
    return Math.max(1, Math.min(10, score));
  }

  /**
   * Detect red flags in symptoms
   */
  async detectRedFlags(symptoms, chiefComplaint, organizationId) {
    const redFlags = [];
    const symptomText = `${chiefComplaint || ''} ${JSON.stringify(symptoms)}`.toLowerCase();

    try {
      // Get organization-specific red flags
      const result = await db.query(
        'SELECT * FROM triage_red_flags WHERE organization_id = $1 AND is_active = true',
        [organizationId]
      );

      for (const redFlag of result.rows) {
        if (redFlag.symptom_patterns && Array.isArray(redFlag.symptom_patterns)) {
          for (const pattern of redFlag.symptom_patterns) {
            if (symptomText.includes(pattern.toLowerCase())) {
              redFlags.push({
                name: redFlag.red_flag_name,
                description: redFlag.red_flag_description,
                severity: redFlag.severity_level,
                escalation_action: redFlag.escalation_action,
                protocol_id: redFlag.protocol_id
              });
              break; // Don't add same red flag twice
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching red flags from database:', error);
    }

    // Add default red flags if none found
    if (redFlags.length === 0) {
      redFlags.push(...this.getDefaultRedFlags(symptomText));
    }

    return redFlags;
  }

  /**
   * Get default red flags
   */
  getDefaultRedFlags(symptomText) {
    const defaultFlags = [];

    if (this.containsKeywords(symptomText, ['chest pain', 'pressure in chest', 'tightness in chest'])) {
      defaultFlags.push({
        name: 'Cardiac Symptoms',
        description: 'Chest pain or pressure may indicate heart problems',
        severity: 'critical',
        escalation_action: '911'
      });
    }

    if (this.containsKeywords(symptomText, ['difficulty breathing', 'cannot breathe', 'shortness of breath', 'wheezing'])) {
      defaultFlags.push({
        name: 'Respiratory Distress',
        description: 'Difficulty breathing requires immediate attention',
        severity: 'critical',
        escalation_action: '911'
      });
    }

    if (this.containsKeywords(symptomText, ['stroke', 'numbness', 'weakness', 'slurred speech', 'vision problems', 'sudden headache'])) {
      defaultFlags.push({
        name: 'Possible Stroke',
        description: 'Stroke symptoms require immediate emergency care',
        severity: 'critical',
        escalation_action: '911'
      });
    }

    if (this.containsKeywords(symptomText, ['severe bleeding', 'uncontrolled bleeding', 'bleeding profusely'])) {
      defaultFlags.push({
        name: 'Severe Bleeding',
        description: 'Uncontrolled bleeding requires immediate attention',
        severity: 'critical',
        escalation_action: '911'
      });
    }

    if (this.containsKeywords(symptomText, ['unconscious', 'unresponsive', 'not breathing', 'stopped breathing'])) {
      defaultFlags.push({
        name: 'Unconscious/Not Breathing',
        description: 'Patient is unconscious or not breathing - call 911 immediately',
        severity: 'critical',
        escalation_action: '911'
      });
    }

    return defaultFlags;
  }

  /**
   * Determine urgency level
   */
  determineUrgencyLevel(severityScore, redFlags) {
    // Critical red flags = critical urgency
    const hasCriticalRedFlag = redFlags.some(flag => flag.severity === 'critical');
    if (hasCriticalRedFlag) {
      return 'critical';
    }

    // Emergent red flags = emergent urgency
    const hasEmergentRedFlag = redFlags.some(flag => flag.severity === 'emergent');
    if (hasEmergentRedFlag) {
      return 'emergent';
    }

    // Based on severity score
    if (severityScore >= 9) {
      return 'critical';
    } else if (severityScore >= 7) {
      return 'emergent';
    } else if (severityScore >= 5) {
      return 'urgent';
    } else {
      return 'routine';
    }
  }

  /**
   * Determine protocol pathway
   */
  async determineProtocolPathway(symptoms, chiefComplaint, organizationId) {
    const symptomText = `${chiefComplaint || ''} ${JSON.stringify(symptoms)}`.toLowerCase();

    try {
      // Get organization-specific protocols
      const result = await db.query(
        'SELECT * FROM triage_protocols WHERE organization_id = $1 AND is_active = true',
        [organizationId]
      );

      for (const protocol of result.rows) {
        if (protocol.symptom_keywords && Array.isArray(protocol.symptom_keywords)) {
          for (const keyword of protocol.symptom_keywords) {
            if (symptomText.includes(keyword.toLowerCase())) {
              return protocol.protocol_name;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching protocols from database:', error);
    }

    // Default protocol matching
    if (this.containsKeywords(symptomText, ['chest pain', 'chest pressure', 'heart'])) {
      return 'chest_pain';
    } else if (this.containsKeywords(symptomText, ['difficulty breathing', 'shortness of breath', 'wheezing', 'asthma'])) {
      return 'difficulty_breathing';
    } else if (this.containsKeywords(symptomText, ['rash', 'skin', 'itching'])) {
      return 'mild_rash';
    } else if (this.containsKeywords(symptomText, ['headache', 'head pain', 'migraine'])) {
      return 'headache';
    } else if (this.containsKeywords(symptomText, ['fever', 'high temperature'])) {
      return 'fever';
    } else if (this.containsKeywords(symptomText, ['abdominal pain', 'stomach pain', 'belly pain'])) {
      return 'abdominal_pain';
    } else {
      return 'general_assessment';
    }
  }

  /**
   * Get triage decision based on pathway and urgency
   */
  async getTriageDecision(protocolPathway, urgencyLevel, redFlags, organizationId) {
    // Check for critical red flags first
    const criticalRedFlag = redFlags.find(flag => flag.severity === 'critical');
    if (criticalRedFlag) {
      return {
        decision: `URGENT: Based on your symptoms, you should ${criticalRedFlag.escalation_action === '911' ? 'call 911 immediately' : 'seek immediate emergency care'}. ${criticalRedFlag.description}`,
        action: criticalRedFlag.escalation_action,
        urgency: 'critical'
      };
    }

    // Get protocol-specific decision
    try {
      const result = await db.query(
        'SELECT * FROM triage_protocols WHERE protocol_name = $1 AND (organization_id = $2 OR organization_id IS NULL) AND is_active = true ORDER BY organization_id DESC LIMIT 1',
        [protocolPathway, organizationId]
      );

      if (result.rows.length > 0) {
        const protocol = result.rows[0];
        return this.processProtocolDecisionTree(protocol, urgencyLevel);
      }
    } catch (error) {
      console.error('Error fetching protocol:', error);
    }

    // Default decisions based on pathway
    return this.getDefaultTriageDecision(protocolPathway, urgencyLevel);
  }

  /**
   * Process protocol decision tree
   */
  processProtocolDecisionTree(protocol, urgencyLevel) {
    const decisionTree = protocol.decision_tree || {};
    const escalationAction = protocol.escalation_action;

    if (urgencyLevel === 'critical' || urgencyLevel === 'emergent') {
      return {
        decision: `${protocol.protocol_description || 'Based on your symptoms'} - You should ${this.formatEscalationAction(escalationAction)}`,
        action: escalationAction,
        urgency: urgencyLevel
      };
    } else if (urgencyLevel === 'urgent') {
      return {
        decision: `${protocol.protocol_description || 'Based on your symptoms'} - You should schedule a visit with your provider soon`,
        action: 'schedule_visit',
        urgency: 'urgent'
      };
    } else {
      return {
        decision: `${protocol.protocol_description || 'Based on your symptoms'} - You can schedule a routine visit with your provider`,
        action: 'schedule_visit',
        urgency: 'routine'
      };
    }
  }

  /**
   * Get default triage decision
   */
  getDefaultTriageDecision(protocolPathway, urgencyLevel) {
    const defaultDecisions = {
      chest_pain: {
        critical: {
          decision: 'URGENT: Chest pain can be a sign of a heart attack. Please call 911 immediately or go to the nearest emergency room.',
          action: '911',
          urgency: 'critical'
        },
        emergent: {
          decision: 'Your chest pain symptoms require immediate medical attention. Please call 911 or go to the emergency room.',
          action: '911',
          urgency: 'emergent'
        },
        urgent: {
          decision: 'Based on your chest pain, you should see a healthcare provider today. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'urgent'
        },
        routine: {
          decision: 'Your symptoms may benefit from a provider visit. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'routine'
        }
      },
      difficulty_breathing: {
        critical: {
          decision: 'URGENT: Difficulty breathing requires immediate attention. Please call 911 immediately.',
          action: '911',
          urgency: 'critical'
        },
        emergent: {
          decision: 'Your breathing difficulties require immediate medical attention. Please call 911 or go to the emergency room.',
          action: '911',
          urgency: 'emergent'
        },
        urgent: {
          decision: 'Based on your breathing symptoms, you should see a healthcare provider soon. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'urgent'
        },
        routine: {
          decision: 'Your breathing symptoms may benefit from a provider visit. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'routine'
        }
      },
      mild_rash: {
        critical: {
          decision: 'URGENT: Severe rash symptoms require immediate attention. Please call 911 or go to the emergency room.',
          action: '911',
          urgency: 'critical'
        },
        emergent: {
          decision: 'Your rash symptoms require medical attention. Please schedule an appointment with your provider today.',
          action: 'schedule_visit',
          urgency: 'urgent'
        },
        urgent: {
          decision: 'Based on your rash, you should schedule a visit with your provider. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'urgent'
        },
        routine: {
          decision: 'Your rash may benefit from a provider visit. Would you like me to help you schedule an appointment?',
          action: 'schedule_visit',
          urgency: 'routine'
        }
      }
    };

    const pathwayDecision = defaultDecisions[protocolPathway];
    if (pathwayDecision && pathwayDecision[urgencyLevel]) {
      return pathwayDecision[urgencyLevel];
    }

    // Generic decision
    if (urgencyLevel === 'critical' || urgencyLevel === 'emergent') {
      return {
        decision: 'Your symptoms require immediate medical attention. Please call 911 or go to the emergency room.',
        action: '911',
        urgency: urgencyLevel
      };
    } else {
      return {
        decision: 'Based on your symptoms, you should schedule a visit with your healthcare provider. Would you like me to help you schedule an appointment?',
        action: 'schedule_visit',
        urgency: urgencyLevel
      };
    }
  }

  /**
   * Format escalation action for display
   */
  formatEscalationAction(action) {
    switch (action) {
      case '911':
        return 'call 911 immediately or go to the nearest emergency room';
      case 'emergency_department':
        return 'go to the emergency department';
      case 'provider_call':
        return 'contact your healthcare provider immediately';
      case 'schedule_visit':
        return 'schedule a visit with your healthcare provider';
      default:
        return action;
    }
  }

  /**
   * Helper: Check if text contains keywords
   */
  containsKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * Get symptom checker functions for OpenAI function calling
   */
  getSymptomCheckerFunctions() {
    return [
      {
        name: 'assess_symptoms',
        description: 'Assess patient symptoms and determine urgency level. Use this when a patient describes symptoms or health concerns.',
        parameters: {
          type: 'object',
          properties: {
            chief_complaint: {
              type: 'string',
              description: 'Main reason for the visit or concern'
            },
            symptoms: {
              type: 'object',
              description: 'Structured symptom data including type, severity, duration, location, and other relevant details'
            }
          },
          required: ['symptoms']
        }
      }
    ];
  }
}

module.exports = new SymptomCheckerService();

