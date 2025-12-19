/**
 * TCPA/FCC Compliance Service
 * Consent tracking and Do Not Call list management
 */

const db = require('../config/database');

class TCPAComplianceService {
  /**
   * Add phone number to Do Not Call list
   */
  async addToDoNotCallList(phoneNumber, organizationId, reason, addedBy) {
    try {
      // Check if already exists
      const existingResult = await db.query(
        'SELECT * FROM do_not_call_list WHERE organization_id = $1 AND phone_number = $2',
        [organizationId, phoneNumber]
      );

      if (existingResult.rows.length > 0) {
        // Update existing record
        await db.query(
          `UPDATE do_not_call_list 
           SET verified = true, reason = $1, added_by = $2, added_at = CURRENT_TIMESTAMP
           WHERE organization_id = $3 AND phone_number = $4`,
          [reason, addedBy, organizationId, phoneNumber]
        );
        return existingResult.rows[0];
      }

      // Create new record
      const result = await db.query(
        `INSERT INTO do_not_call_list (
          organization_id, phone_number, reason, added_by, verified
        ) VALUES ($1, $2, $3, $4, true)
        RETURNING *`,
        [organizationId, phoneNumber, reason || 'customer_request', addedBy]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error adding to Do Not Call list:', error);
      throw error;
    }
  }

  /**
   * Remove phone number from Do Not Call list
   */
  async removeFromDoNotCallList(phoneNumber, organizationId) {
    try {
      const result = await db.query(
        'DELETE FROM do_not_call_list WHERE organization_id = $1 AND phone_number = $2 RETURNING *',
        [organizationId, phoneNumber]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error removing from Do Not Call list:', error);
      throw error;
    }
  }

  /**
   * Check if phone number is on Do Not Call list
   */
  async isOnDoNotCallList(phoneNumber, organizationId) {
    try {
      const result = await db.query(
        'SELECT * FROM do_not_call_list WHERE organization_id = $1 AND phone_number = $2 AND verified = true',
        [organizationId, phoneNumber]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking Do Not Call list:', error);
      return false;
    }
  }

  /**
   * Grant consent for communications
   */
  async grantConsent(consentData, organizationId) {
    try {
      const {
        patient_identifier,
        consent_type,
        consent_method,
        consent_text,
        expiration_date,
        verification_code,
        recorded_by,
        ip_address,
        user_agent
      } = consentData;

      if (!patient_identifier || !consent_type) {
        throw new Error('Patient identifier and consent type are required');
      }

      // Revoke any existing consent of the same type first (optional - you might want to keep history)
      // For now, we'll update existing consent to 'revoked' and create a new one

      const result = await db.query(
        `INSERT INTO collections_consent_records (
          organization_id, patient_identifier, consent_type, consent_status,
          consent_method, consent_date, expiration_date, consent_text,
          verification_code, recorded_by, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          organizationId,
          patient_identifier,
          consent_type,
          'granted',
          consent_method || 'verbal',
          new Date(),
          expiration_date ? new Date(expiration_date) : null,
          consent_text || null,
          verification_code || null,
          recorded_by || null,
          ip_address || null,
          user_agent || null
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error granting consent:', error);
      throw error;
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(patientIdentifier, consentType, organizationId) {
    try {
      // Revoke all active consents of this type
      const result = await db.query(
        `UPDATE collections_consent_records 
         SET consent_status = 'revoked', revocation_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 
         AND patient_identifier = $2 
         AND consent_type = $3
         AND consent_status = 'granted'
         RETURNING *`,
        [organizationId, patientIdentifier, consentType]
      );

      return result.rows;
    } catch (error) {
      console.error('Error revoking consent:', error);
      throw error;
    }
  }

  /**
   * Check if consent exists and is valid
   */
  async hasValidConsent(patientIdentifier, consentType, organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM collections_consent_records 
         WHERE organization_id = $1 
         AND patient_identifier = $2 
         AND consent_type = $3
         AND consent_status = 'granted'
         AND (expiration_date IS NULL OR expiration_date > CURRENT_TIMESTAMP)
         ORDER BY consent_date DESC
         LIMIT 1`,
        [organizationId, patientIdentifier, consentType]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error checking consent:', error);
      return null;
    }
  }

  /**
   * Verify consent with verification code (double opt-in)
   */
  async verifyConsent(patientIdentifier, consentType, verificationCode, organizationId) {
    try {
      const result = await db.query(
        `UPDATE collections_consent_records 
         SET verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 
         AND patient_identifier = $2 
         AND consent_type = $3
         AND verification_code = $4
         AND verified_at IS NULL
         RETURNING *`,
        [organizationId, patientIdentifier, consentType, verificationCode]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error verifying consent:', error);
      throw error;
    }
  }

  /**
   * Get consent history for patient
   */
  async getConsentHistory(patientIdentifier, organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM collections_consent_records 
         WHERE organization_id = $1 
         AND patient_identifier = $2 
         ORDER BY consent_date DESC`,
        [organizationId, patientIdentifier]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting consent history:', error);
      return [];
    }
  }

  /**
   * Check TCPA compliance before making contact
   */
  async checkTCPACompliance(phoneNumber, organizationId, contactType) {
    // Check Do Not Call list
    const isOnDNC = await this.isOnDoNotCallList(phoneNumber, organizationId);
    if (isOnDNC) {
      return {
        compliant: false,
        reason: 'Phone number is on Do Not Call list',
        can_contact: false
      };
    }

    // Check consent for SMS and automated calls
    if (contactType === 'sms' || contactType === 'automated_call') {
      const consent = await this.hasValidConsent(phoneNumber, contactType === 'sms' ? 'sms' : 'call', organizationId);
      if (!consent) {
        return {
          compliant: false,
          reason: 'No valid consent found for this contact type',
          can_contact: false
        };
      }

      return {
        compliant: true,
        reason: 'Valid consent found',
        can_contact: true,
        consent_record: consent
      };
    }

    // For manual calls to existing customers, implied consent may apply
    // But explicit consent is always safer
    return {
      compliant: true,
      reason: 'Contact type does not require explicit consent',
      can_contact: true
    };
  }

  /**
   * Get TCPA compliance functions for OpenAI function calling
   */
  getTCPAFunctions() {
    return [
      {
        name: 'grant_communication_consent',
        description: 'Record that a patient has granted consent for communications (SMS, calls, etc.). Use this when a patient agrees to receive communications.',
        parameters: {
          type: 'object',
          properties: {
            consent_type: {
              type: 'string',
              description: 'Type of consent',
              enum: ['sms', 'call', 'email', 'automated_call', 'automated_text']
            },
            consent_method: {
              type: 'string',
              description: 'Method of consent',
              enum: ['verbal', 'written', 'electronic', 'implied']
            },
            consent_text: {
              type: 'string',
              description: 'Text of what was consented to'
            },
            expiration_date: {
              type: 'string',
              description: 'Expiration date (YYYY-MM-DD format, optional)'
            }
          },
          required: ['consent_type']
        }
      },
      {
        name: 'revoke_communication_consent',
        description: 'Revoke a patient\'s consent for communications. Use this when a patient requests to opt-out of communications.',
        parameters: {
          type: 'object',
          properties: {
            consent_type: {
              type: 'string',
              description: 'Type of consent to revoke',
              enum: ['sms', 'call', 'email', 'automated_call', 'automated_text']
            }
          },
          required: ['consent_type']
        }
      },
      {
        name: 'add_to_do_not_call_list',
        description: 'Add a phone number to the Do Not Call list. Use this when a patient requests to be added to the Do Not Call list.',
        parameters: {
          type: 'object',
          properties: {
            phone_number: {
              type: 'string',
              description: 'Phone number to add to Do Not Call list'
            },
            reason: {
              type: 'string',
              description: 'Reason for adding to Do Not Call list'
            }
          },
          required: ['phone_number']
        }
      }
    ];
  }
}

module.exports = new TCPAComplianceService();

