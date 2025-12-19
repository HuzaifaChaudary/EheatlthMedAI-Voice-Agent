/**
 * Insurance Question Answering Service
 * Answers insurance questions with structured data
 */

const db = require('../config/database');

class InsuranceQAService {
  /**
   * Answer insurance question
   */
  async answerInsuranceQuestion(conversationId, questionData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        question,
        question_category
      } = questionData;

      // Validate required fields
      if (!question) {
        throw new Error('Question is required');
      }

      // Search knowledge base for answer
      const answer = await this.searchKnowledgeBase(question, question_category, organizationId);

      // Get patient insurance information if available
      let patientInsurance = null;
      if (patient_email || patient_phone) {
        patientInsurance = await this.getPatientInsurance(
          patient_email || patient_phone,
          organizationId
        );
      }

      // Enhance answer with patient-specific insurance info
      const enhancedAnswer = this.enhanceAnswerWithInsuranceInfo(answer, patientInsurance, question);

      return {
        question: question,
        answer: enhancedAnswer.answer,
        source: enhancedAnswer.source,
        patient_insurance: patientInsurance,
        related_questions: enhancedAnswer.related_questions || []
      };
    } catch (error) {
      console.error('Error answering insurance question:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base for answer
   */
  async searchKnowledgeBase(question, category, organizationId) {
    try {
      const lowerQuestion = question.toLowerCase();
      
      // Search by keywords in question
      let query = `
        SELECT * FROM insurance_qa_knowledge_base 
        WHERE (organization_id = $1 OR organization_id IS NULL)
        AND is_active = true
      `;
      const params = [organizationId];
      let paramCount = 1;

      if (category) {
        paramCount++;
        query += ` AND question_category = $${paramCount}`;
        params.push(category);
      }

      query += ' ORDER BY organization_id DESC NULLS LAST';

      const result = await db.query(query, params);

      // Find best match
      let bestMatch = null;
      let bestScore = 0;

      for (const qa of result.rows) {
        let score = 0;

        // Check if question text matches
        if (qa.question.toLowerCase().includes(lowerQuestion) || 
            lowerQuestion.includes(qa.question.toLowerCase())) {
          score += 10;
        }

        // Check keywords
        if (qa.related_keywords && Array.isArray(qa.related_keywords)) {
          for (const keyword of qa.related_keywords) {
            if (lowerQuestion.includes(keyword.toLowerCase())) {
              score += 5;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = qa;
        }
      }

      if (bestMatch) {
        return {
          answer: bestMatch.answer,
          source: 'knowledge_base',
          related_questions: this.getRelatedQuestions(bestMatch.question_category, organizationId, bestMatch.id)
        };
      }

      // Return default answer if no match found
      return {
        answer: this.getDefaultAnswer(question, category),
        source: 'default',
        related_questions: []
      };
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return {
        answer: this.getDefaultAnswer(question, category),
        source: 'default',
        related_questions: []
      };
    }
  }

  /**
   * Get patient insurance information
   */
  async getPatientInsurance(patientIdentifier, organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM insurance_information 
         WHERE patient_identifier = $1 
         AND (organization_id = $2 OR organization_id IS NULL)
         AND is_active = true
         ORDER BY organization_id DESC NULLS LAST, effective_date DESC
         LIMIT 1`,
        [patientIdentifier, organizationId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting patient insurance:', error);
      return null;
    }
  }

  /**
   * Enhance answer with patient-specific insurance info
   */
  enhanceAnswerWithInsuranceInfo(answer, patientInsurance, question) {
    if (!patientInsurance) {
      return answer;
    }

    const lowerQuestion = question.toLowerCase();
    let enhancedAnswer = answer.answer;

    // Add patient-specific information based on question
    if (lowerQuestion.includes('copay') || lowerQuestion.includes('co-pay')) {
      if (patientInsurance.copay_amount) {
        enhancedAnswer += `\n\nBased on your insurance information, your copay is $${parseFloat(patientInsurance.copay_amount).toFixed(2)}.`;
      }
    }

    if (lowerQuestion.includes('deductible')) {
      if (patientInsurance.deductible_amount) {
        enhancedAnswer += `\n\nYour deductible is $${parseFloat(patientInsurance.deductible_amount).toFixed(2)}.`;
      }
    }

    if (lowerQuestion.includes('coverage') || lowerQuestion.includes('covered')) {
      if (patientInsurance.coverage_details) {
        const coverage = typeof patientInsurance.coverage_details === 'string' 
          ? JSON.parse(patientInsurance.coverage_details) 
          : patientInsurance.coverage_details;
        
        if (coverage.covered_services) {
          enhancedAnswer += `\n\nYour insurance covers: ${coverage.covered_services.join(', ')}.`;
        }
      }
    }

    if (lowerQuestion.includes('out of pocket') || lowerQuestion.includes('maximum')) {
      if (patientInsurance.out_of_pocket_maximum) {
        enhancedAnswer += `\n\nYour out-of-pocket maximum is $${parseFloat(patientInsurance.out_of_pocket_maximum).toFixed(2)}.`;
      }
    }

    return {
      answer: enhancedAnswer,
      source: answer.source,
      related_questions: answer.related_questions
    };
  }

  /**
   * Get related questions
   */
  async getRelatedQuestions(category, organizationId, excludeId) {
    try {
      const result = await db.query(
        `SELECT question FROM insurance_qa_knowledge_base 
         WHERE question_category = $1 
         AND (organization_id = $2 OR organization_id IS NULL)
         AND id != $3
         AND is_active = true
         LIMIT 3`,
        [category, organizationId, excludeId]
      );

      return result.rows.map(row => row.question);
    } catch (error) {
      console.error('Error getting related questions:', error);
      return [];
    }
  }

  /**
   * Get default answer for question
   */
  getDefaultAnswer(question, category) {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('copay') || lowerQuestion.includes('co-pay')) {
      return 'A copay is a fixed amount you pay for a covered health care service, usually when you receive the service. The amount can vary by the type of covered health care service. Please check your insurance card or contact your insurance provider for your specific copay amounts.';
    }

    if (lowerQuestion.includes('deductible')) {
      return 'A deductible is the amount you pay for covered health care services before your insurance plan starts to pay. For example, if your deductible is $1,000, you pay the first $1,000 of covered services yourself. After you pay your deductible, you usually pay only a copayment or coinsurance for covered services.';
    }

    if (lowerQuestion.includes('coinsurance')) {
      return 'Coinsurance is your share of the costs of a covered health care service, calculated as a percent of the allowed amount for the service. For example, if your coinsurance is 20%, you pay 20% of the allowed amount and your insurance pays 80%.';
    }

    if (lowerQuestion.includes('out of pocket') || lowerQuestion.includes('maximum')) {
      return 'An out-of-pocket maximum is the most you have to pay for covered services in a plan year. After you spend this amount on deductibles, copayments, and coinsurance, your health plan pays 100% of the costs of covered benefits.';
    }

    if (lowerQuestion.includes('claim') || lowerQuestion.includes('submitted')) {
      return 'A claim is a request for payment that you or your health care provider submits to your health insurance company when you receive items or services you think are covered. Your insurance company will review the claim and determine if the service is covered and how much they will pay.';
    }

    if (lowerQuestion.includes('preauthorization') || lowerQuestion.includes('prior authorization')) {
      return 'Prior authorization (also called preauthorization) is approval from your health insurance company for a specific treatment or service before you receive it. Some services require prior authorization to ensure they are medically necessary and covered by your plan.';
    }

    return 'I can help you with insurance questions about coverage, copays, deductibles, claims, and more. For specific information about your insurance plan, please provide your insurance details or contact your insurance provider directly.';
  }

  /**
   * Get insurance QA functions for OpenAI function calling
   */
  getInsuranceQAFunctions() {
    return [
      {
        name: 'answer_insurance_question',
        description: 'Answer a patient\'s insurance-related question using structured data and knowledge base. Use this when a patient asks about insurance coverage, copays, deductibles, claims, or other insurance-related topics.',
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The insurance question the patient is asking'
            },
            question_category: {
              type: 'string',
              description: 'Category of the question (coverage, claims, copay, deductible, etc.)',
              enum: ['coverage', 'claims', 'copay', 'deductible', 'coinsurance', 'out_of_pocket', 'preauthorization', 'general']
            }
          },
          required: ['question']
        }
      }
    ];
  }
}

module.exports = new InsuranceQAService();

