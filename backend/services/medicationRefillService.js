/**
 * Medication Refill Service
 * Handles medication refill requests with protocol-based decision trees
 */

const db = require('../config/database');

class MedicationRefillService {
  /**
   * Process medication refill request with protocol-based decision tree
   */
  async processRefillRequest(conversationId, requestData, organizationId, ehrSystemId = null) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        medication_name,
        dosage,
        frequency,
        last_filled_date,
        days_supply,
        additional_info
      } = requestData;

      // Try to get medication history from EMR if EHR system is available
      let emrMedicationHistory = [];
      if (ehrSystemId && patient_email) {
        try {
          const emrMedicationService = require('./emrMedicationService');
          emrMedicationHistory = await emrMedicationService.getMedicationHistory(
            patient_email, // Using email as patient identifier, could also use patient ID
            ehrSystemId,
            organizationId
          );
        } catch (emrError) {
          console.error('Error fetching EMR medication history (non-blocking):', emrError);
          // Continue without EMR data - graceful degradation
        }
      }

      // Validate required fields
      if (!patient_name || !medication_name) {
        throw new Error('Patient name and medication name are required');
      }

      // Get applicable protocol
      const protocol = await this.getApplicableProtocol(medication_name, organizationId);

      // Evaluate protocol decision tree
      const decision = await this.evaluateProtocol(protocol, requestData);

      // Create refill request record
      const result = await db.query(
        `INSERT INTO medication_refill_requests (
          conversation_id, patient_name, patient_phone, patient_email,
          medication_name, dosage, frequency, last_filled_date, days_supply,
          status, protocol_decision, protocol_reason, provider_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          conversationId,
          patient_name,
          patient_phone || null,
          patient_email || null,
          medication_name,
          dosage || null,
          frequency || null,
          last_filled_date || null,
          days_supply || null,
          decision.status,
          decision.decision,
          decision.reason,
          additional_info || null
        ]
      );

      const refillRequest = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('medication.refill_requested', {
          refill_request_id: refillRequest.id,
          conversation_id: conversationId,
          medication_name: medication_name,
          status: decision.status,
          protocol_decision: decision.decision,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering medication.refill_requested webhook:', webhookError);
      }

      return {
        refill_request: refillRequest,
        decision: decision,
        message: this.generateDecisionMessage(decision, medication_name)
      };
    } catch (error) {
      console.error('Error processing medication refill request:', error);
      throw error;
    }
  }

  /**
   * Get applicable protocol for medication
   */
  async getApplicableProtocol(medicationName, organizationId) {
    try {
      // First try exact match
      let result = await db.query(
        `SELECT * FROM medication_protocols 
         WHERE organization_id = $1 
         AND is_active = true 
         AND medication_name_pattern = $2
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, medicationName]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Try pattern match (e.g., "insulin*")
      result = await db.query(
        `SELECT * FROM medication_protocols 
         WHERE organization_id = $1 
         AND is_active = true 
         AND medication_name_pattern LIKE $2
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, medicationName.replace('*', '%')]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Return default protocol if none found
      return this.getDefaultProtocol();
    } catch (error) {
      console.error('Error getting medication protocol:', error);
      return this.getDefaultProtocol();
    }
  }

  /**
   * Get default protocol (safe defaults)
   */
  getDefaultProtocol() {
    return {
      id: null,
      protocol_rules: {
        max_days_since_last_fill: 90,
        min_days_between_refills: 25,
        requires_review_for_controlled: true
      },
      auto_approve_conditions: {
        days_since_last_fill: { max: 90 },
        days_between_refills: { min: 25 }
      },
      auto_deny_conditions: {
        days_since_last_fill: { min: 365 },
        controlled_substance_without_review: true
      },
      requires_review_conditions: {
        days_since_last_fill: { min: 90, max: 365 },
        controlled_substance: true,
        first_time_refill: true
      }
    };
  }

  /**
   * Evaluate protocol decision tree
   */
  async evaluateProtocol(protocol, requestData) {
    const rules = protocol.protocol_rules || {};
    const autoApprove = protocol.auto_approve_conditions || {};
    const autoDeny = protocol.auto_deny_conditions || {};
    const requiresReview = protocol.requires_review_conditions || {};

    // Calculate days since last fill
    let daysSinceLastFill = null;
    if (requestData.last_filled_date) {
      const lastFill = new Date(requestData.last_filled_date);
      const today = new Date();
      daysSinceLastFill = Math.floor((today - lastFill) / (1000 * 60 * 60 * 24));
    }

    // Check auto-deny conditions
    if (autoDeny.days_since_last_fill?.min && daysSinceLastFill && daysSinceLastFill >= autoDeny.days_since_last_fill.min) {
      return {
        decision: 'auto_deny',
        status: 'denied',
        reason: `Last refill was ${daysSinceLastFill} days ago. Please schedule an appointment with your provider.`
      };
    }

    // Check if medication is verified in EMR
    if (!medicationVerified && requestData.medication_name) {
      // Medication not found in EMR - may require review
      return {
        decision: 'requires_review',
        status: 'requires_provider_review',
        reason: 'Medication not found in patient record. Provider review required.'
      };
    }

    // Check controlled substance (requires review)
    const isControlledSubstance = this.isControlledSubstance(requestData.medication_name);
    if (isControlledSubstance && requiresReview.controlled_substance) {
      return {
        decision: 'requires_review',
        status: 'requires_provider_review',
        reason: 'This medication requires provider review before approval.'
      };
    }

    // Check auto-approve conditions
    if (autoApprove.days_since_last_fill?.max && daysSinceLastFill && daysSinceLastFill <= autoApprove.days_since_last_fill.max) {
      if (autoApprove.days_between_refills?.min && requestData.days_supply) {
        const daysBetweenRefills = requestData.days_supply;
        if (daysBetweenRefills >= autoApprove.days_between_refills.min) {
          return {
            decision: 'auto_approve',
            status: 'approved',
            reason: 'Refill approved based on protocol criteria.'
          };
        }
      }
    }

    // Check requires review conditions
    if (requiresReview.days_since_last_fill) {
      const min = requiresReview.days_since_last_fill.min;
      const max = requiresReview.days_since_last_fill.max;
      if (daysSinceLastFill && daysSinceLastFill >= min && daysSinceLastFill <= max) {
        return {
          decision: 'requires_review',
          status: 'requires_provider_review',
          reason: 'Refill requires provider review due to time since last fill.'
        };
      }
    }

    // Default: requires review for safety
    return {
      decision: 'requires_review',
      status: 'requires_provider_review',
      reason: 'Refill request requires provider review for safety.'
    };
  }

  /**
   * Check if medication is a controlled substance
   */
  isControlledSubstance(medicationName) {
    const controlledPatterns = [
      'opioid', 'oxycodone', 'hydrocodone', 'morphine', 'fentanyl',
      'adderall', 'ritalin', 'benzodiazepine', 'xanax', 'valium',
      'ambien', 'lunesta', 'testosterone', 'anabolic'
    ];

    const lowerName = medicationName.toLowerCase();
    return controlledPatterns.some(pattern => lowerName.includes(pattern));
  }

  /**
   * Generate decision message for patient
   */
  generateDecisionMessage(decision, medicationName) {
    switch (decision.status) {
      case 'approved':
        return `Your refill request for ${medicationName} has been approved. Your pharmacy will be notified.`;
      case 'denied':
        return `Your refill request for ${medicationName} cannot be approved at this time. ${decision.reason} Please contact your provider's office.`;
      case 'requires_provider_review':
        return `Your refill request for ${medicationName} has been submitted and is pending provider review. ${decision.reason} You will be notified once reviewed.`;
      default:
        return `Your refill request for ${medicationName} has been received and is being processed.`;
    }
  }

  /**
   * Get refill request functions for OpenAI function calling
   */
  getRefillFunctions() {
    return [
      {
        name: 'request_medication_refill',
        description: 'Request a medication refill for a patient. Use this when a patient asks to refill a prescription.',
        parameters: {
          type: 'object',
          properties: {
            medication_name: {
              type: 'string',
              description: 'Name of the medication to refill'
            },
            dosage: {
              type: 'string',
              description: 'Dosage of the medication (e.g., "10mg", "500mg twice daily")'
            },
            frequency: {
              type: 'string',
              description: 'How often the medication is taken (e.g., "once daily", "twice daily", "as needed")'
            },
            last_filled_date: {
              type: 'string',
              description: 'Date when medication was last filled (YYYY-MM-DD format)'
            },
            days_supply: {
              type: 'number',
              description: 'Number of days the last prescription was supposed to last'
            },
            additional_info: {
              type: 'string',
              description: 'Any additional information about the refill request'
            }
          },
          required: ['medication_name']
        }
      }
    ];
  }
}

module.exports = new MedicationRefillService();

