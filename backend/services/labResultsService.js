/**
 * Lab Results Service
 * Handles lab results explanation with normal ranges
 */

const db = require('../config/database');

class LabResultsService {
  /**
   * Explain lab result with normal ranges
   */
  async explainLabResult(conversationId, resultData, organizationId, labSystemId = null) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        test_name,
        test_type,
        result_value,
        unit,
        test_date
      } = resultData;

      // If result value is not provided, try to get it from lab system
      let labResultFromSystem = null;
      if (labSystemId && patient_email && !result_value) {
        try {
          const labSystemsService = require('./labSystemsService');
          labResultFromSystem = await labSystemsService.getLabResultByTestName(
            patient_email, // Using email as patient identifier
            test_name,
            labSystemId,
            organizationId
          );

          if (labResultFromSystem) {
            // Use data from lab system
            resultData.result_value = labResultFromSystem.result_value;
            resultData.unit = labResultFromSystem.unit || resultData.unit;
            resultData.test_date = labResultFromSystem.test_date || resultData.test_date;
            resultData.test_type = labResultFromSystem.test_type || resultData.test_type;
          }
        } catch (labError) {
          console.error('Error fetching lab result from lab system (non-blocking):', labError);
          // Continue without lab system data - graceful degradation
        }
      }

      // Validate required fields
      if (!patient_name || !test_name || !result_value) {
        throw new Error('Patient name, test name, and result value are required');
      }

      // Get normal range for this test
      const normalRange = await this.getNormalRange(test_name, organizationId);

      // Determine status (normal, abnormal, critical)
      const status = this.determineStatus(result_value, normalRange);

      // Generate interpretation
      const interpretation = this.generateInterpretation(test_name, result_value, normalRange, status);

      // Create lab result record
      const result = await db.query(
        `INSERT INTO lab_results (
          conversation_id, patient_name, patient_phone, patient_email,
          test_name, test_type, result_value, unit,
          normal_range_min, normal_range_max, normal_range_text,
          status, interpretation, test_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          conversationId,
          patient_name,
          patient_phone || null,
          patient_email || null,
          test_name,
          test_type || null,
          result_value,
          unit || null,
          normalRange.min || null,
          normalRange.max || null,
          normalRange.text || null,
          status,
          interpretation,
          test_date || new Date()
        ]
      );

      const labResult = result.rows[0];

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('lab_result.explained', {
          lab_result_id: labResult.id,
          conversation_id: conversationId,
          test_name: test_name,
          status: status,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering lab_result.explained webhook:', webhookError);
      }

      return {
        lab_result: labResult,
        explanation: this.formatExplanationForPatient(labResult, normalRange)
      };
    } catch (error) {
      console.error('Error explaining lab result:', error);
      throw error;
    }
  }

  /**
   * Get normal range for test
   */
  async getNormalRange(testName, organizationId) {
    try {
      // Try exact match first
      let result = await db.query(
        `SELECT * FROM lab_test_ranges 
         WHERE organization_id = $1 
         AND is_active = true 
         AND test_name = $2
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, testName]
      );

      if (result.rows.length > 0) {
        const range = result.rows[0];
        return {
          min: range.normal_range_min,
          max: range.normal_range_max,
          text: range.normal_range_text,
          unit: range.unit,
          notes: range.interpretation_notes
        };
      }

      // Try case-insensitive match
      result = await db.query(
        `SELECT * FROM lab_test_ranges 
         WHERE organization_id = $1 
         AND is_active = true 
         AND LOWER(test_name) = LOWER($2)
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, testName]
      );

      if (result.rows.length > 0) {
        const range = result.rows[0];
        return {
          min: range.normal_range_min,
          max: range.normal_range_max,
          text: range.normal_range_text,
          unit: range.unit,
          notes: range.interpretation_notes
        };
      }

      // Return default ranges for common tests
      return this.getDefaultNormalRange(testName);
    } catch (error) {
      console.error('Error getting normal range:', error);
      return this.getDefaultNormalRange(testName);
    }
  }

  /**
   * Get default normal ranges for common tests
   */
  getDefaultNormalRange(testName) {
    const lowerName = testName.toLowerCase();
    
    const defaultRanges = {
      'glucose': { min: 70, max: 100, text: '70-100 mg/dL', unit: 'mg/dL' },
      'hemoglobin a1c': { min: 4, max: 5.6, text: '4.0-5.6%', unit: '%' },
      'cholesterol': { min: 0, max: 200, text: '<200 mg/dL', unit: 'mg/dL' },
      'hdl': { min: 40, max: 100, text: '40-100 mg/dL', unit: 'mg/dL' },
      'ldl': { min: 0, max: 100, text: '<100 mg/dL', unit: 'mg/dL' },
      'triglycerides': { min: 0, max: 150, text: '<150 mg/dL', unit: 'mg/dL' },
      'blood pressure': { min: 90, max: 120, text: '90-120/60-80 mmHg', unit: 'mmHg' },
      'creatinine': { min: 0.6, max: 1.2, text: '0.6-1.2 mg/dL', unit: 'mg/dL' },
      'tsh': { min: 0.4, max: 4.0, text: '0.4-4.0 mIU/L', unit: 'mIU/L' }
    };

    for (const [key, range] of Object.entries(defaultRanges)) {
      if (lowerName.includes(key)) {
        return range;
      }
    }

    // Default unknown range
    return {
      min: null,
      max: null,
      text: 'Please consult with your provider for normal ranges',
      unit: null,
      notes: null
    };
  }

  /**
   * Determine status based on result value and normal range
   */
  determineStatus(resultValue, normalRange) {
    if (!normalRange.min && !normalRange.max) {
      return 'pending'; // Cannot determine without range
    }

    const numericValue = parseFloat(resultValue);
    if (isNaN(numericValue)) {
      return 'pending'; // Non-numeric result
    }

    // Check if within range
    if (normalRange.min !== null && normalRange.max !== null) {
      if (numericValue >= normalRange.min && numericValue <= normalRange.max) {
        return 'normal';
      } else if (numericValue < normalRange.min * 0.5 || numericValue > normalRange.max * 1.5) {
        return 'critical'; // Significantly outside range
      } else {
        return 'abnormal';
      }
    } else if (normalRange.max !== null) {
      // Only max value (e.g., <100)
      if (numericValue <= normalRange.max) {
        return 'normal';
      } else if (numericValue > normalRange.max * 1.5) {
        return 'critical';
      } else {
        return 'abnormal';
      }
    } else if (normalRange.min !== null) {
      // Only min value
      if (numericValue >= normalRange.min) {
        return 'normal';
      } else if (numericValue < normalRange.min * 0.5) {
        return 'critical';
      } else {
        return 'abnormal';
      }
    }

    return 'pending';
  }

  /**
   * Generate interpretation text
   */
  generateInterpretation(testName, resultValue, normalRange, status) {
    let interpretation = `Your ${testName} result is ${resultValue}`;
    
    if (normalRange.unit) {
      interpretation += ` ${normalRange.unit}`;
    }

    if (normalRange.text) {
      interpretation += `. The normal range is ${normalRange.text}.`;
    }

    switch (status) {
      case 'normal':
        interpretation += ' This result is within the normal range.';
        break;
      case 'abnormal':
        interpretation += ' This result is outside the normal range. Please discuss with your healthcare provider.';
        break;
      case 'critical':
        interpretation += ' This result is significantly outside the normal range. Please contact your healthcare provider immediately.';
        break;
      default:
        interpretation += ' Please consult with your healthcare provider for interpretation.';
    }

    if (normalRange.notes) {
      interpretation += ` ${normalRange.notes}`;
    }

    return interpretation;
  }

  /**
   * Format explanation for patient
   */
  formatExplanationForPatient(labResult, normalRange) {
    let explanation = `Your ${labResult.test_name} result: ${labResult.result_value}`;
    
    if (labResult.unit) {
      explanation += ` ${labResult.unit}`;
    }

    if (normalRange.text) {
      explanation += `\n\nNormal range: ${normalRange.text}`;
    }

    explanation += `\n\n${labResult.interpretation}`;

    return explanation;
  }

  /**
   * Get lab result explanation functions for OpenAI function calling
   */
  getLabResultFunctions() {
    return [
      {
        name: 'explain_lab_result',
        description: 'Explain a lab test result to a patient using normal ranges. Use this when a patient asks about their lab results.',
        parameters: {
          type: 'object',
          properties: {
            test_name: {
              type: 'string',
              description: 'Name of the lab test (e.g., "Glucose", "Hemoglobin A1C", "Cholesterol")'
            },
            test_type: {
              type: 'string',
              description: 'Type of test (e.g., "blood", "urine", "imaging")'
            },
            result_value: {
              type: 'string',
              description: 'The test result value (e.g., "95", "5.2", "150")'
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement (e.g., "mg/dL", "%", "mIU/L")'
            },
            test_date: {
              type: 'string',
              description: 'Date when the test was performed (YYYY-MM-DD format)'
            }
          },
          required: ['test_name', 'result_value']
        }
      }
    ];
  }
}

module.exports = new LabResultsService();

