/**
 * Payment Plan Service
 * Payment plan negotiation and management
 */

const db = require('../config/database');
const paymentGatewayService = require('./paymentGatewayService');

class PaymentPlanService {
  /**
   * Create payment plan
   */
  async createPaymentPlan(conversationId, planData, organizationId) {
    try {
      const {
        statement_id,
        patient_name,
        patient_phone,
        patient_email,
        total_amount,
        monthly_payment_amount,
        number_of_payments,
        payment_frequency,
        start_date
      } = planData;

      // Validate required fields
      if (!statement_id || !patient_name || !total_amount || !monthly_payment_amount || !number_of_payments) {
        throw new Error('Statement ID, patient name, total amount, monthly payment amount, and number of payments are required');
      }

      // Validate payment amounts
      const calculatedTotal = monthly_payment_amount * number_of_payments;
      if (Math.abs(calculatedTotal - total_amount) > 0.01) {
        throw new Error(`Payment plan total (${calculatedTotal}) does not match statement total (${total_amount})`);
      }

      // Get statement to verify balance
      const statementResult = await db.query(
        'SELECT * FROM patient_statements WHERE id = $1',
        [statement_id]
      );

      if (statementResult.rows.length === 0) {
        throw new Error('Statement not found');
      }

      const statement = statementResult.rows[0];

      // Calculate next payment date
      const startDate = start_date ? new Date(start_date) : new Date();
      const nextPaymentDate = this.calculateNextPaymentDate(startDate, payment_frequency);

      // Create payment plan
      const planResult = await db.query(
        `INSERT INTO payment_plans (
          conversation_id, statement_id, patient_name, patient_phone, patient_email,
          total_amount, remaining_balance, monthly_payment_amount, number_of_payments,
          payment_frequency, start_date, next_payment_date, terms_agreed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          conversationId,
          statement_id,
          patient_name,
          patient_phone || null,
          patient_email || null,
          total_amount,
          total_amount, // Initial remaining balance equals total
          monthly_payment_amount,
          number_of_payments,
          payment_frequency || 'monthly',
          startDate,
          nextPaymentDate,
          new Date() // Terms agreed now
        ]
      );

      const plan = planResult.rows[0];

      // Create scheduled payment records
      await this.createScheduledPayments(plan.id, plan);

      // Update statement status
      await db.query(
        'UPDATE patient_statements SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['payment_plan_active', statement_id]
      );

      // Log activity
      await this.logActivity(organizationId, statement_id, plan.id, 'payment_plan_created', {
        payment_plan_id: plan.id,
        total_amount: total_amount,
        monthly_payment: monthly_payment_amount,
        number_of_payments: number_of_payments
      }, {
        patient_name: patient_name,
        patient_phone: patient_phone,
        patient_email: patient_email
      });

      return plan;
    } catch (error) {
      console.error('Error creating payment plan:', error);
      throw error;
    }
  }

  /**
   * Create scheduled payments for payment plan
   */
  async createScheduledPayments(planId, plan) {
    const payments = [];
    let currentDate = new Date(plan.start_date);

    for (let i = 0; i < plan.number_of_payments; i++) {
      const scheduledDate = this.calculatePaymentDate(currentDate, plan.payment_frequency, i);
      
      const result = await db.query(
        `INSERT INTO payment_plan_payments (
          payment_plan_id, scheduled_payment_date, payment_amount
        ) VALUES ($1, $2, $3)
        RETURNING *`,
        [planId, scheduledDate, plan.monthly_payment_amount]
      );

      payments.push(result.rows[0]);
      currentDate = scheduledDate;
    }

    return payments;
  }

  /**
   * Calculate next payment date
   */
  calculateNextPaymentDate(startDate, frequency) {
    const next = new Date(startDate);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }

  /**
   * Calculate payment date for scheduled payment
   */
  calculatePaymentDate(startDate, frequency, paymentNumber) {
    const date = new Date(startDate);
    
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + (paymentNumber * 7));
        break;
      case 'biweekly':
        date.setDate(date.getDate() + (paymentNumber * 14));
        break;
      case 'monthly':
      default:
        date.setMonth(date.getMonth() + paymentNumber);
        break;
    }

    return date;
  }

  /**
   * Process payment plan payment
   */
  async processPaymentPlanPayment(planId, paymentAmount, paymentData, organizationId) {
    try {
      // Get payment plan
      const planResult = await db.query(
        'SELECT * FROM payment_plans WHERE id = $1',
        [planId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Payment plan not found');
      }

      const plan = planResult.rows[0];

      if (plan.status !== 'active') {
        throw new Error(`Payment plan is ${plan.status}, cannot process payment`);
      }

      // Get next scheduled payment
      const paymentResult = await db.query(
        `SELECT * FROM payment_plan_payments 
         WHERE payment_plan_id = $1 
         AND payment_status = 'scheduled'
         ORDER BY scheduled_payment_date ASC
         LIMIT 1`,
        [planId]
      );

      if (paymentResult.rows.length === 0) {
        throw new Error('No scheduled payments found');
      }

      const scheduledPayment = paymentResult.rows[0];

      // Process payment through gateway
      const paymentResult_data = await paymentGatewayService.processPayment(
        plan.conversation_id,
        {
          statement_id: plan.statement_id,
          patient_name: plan.patient_name,
          patient_phone: plan.patient_phone,
          patient_email: plan.patient_email,
          payment_amount: paymentAmount || scheduledPayment.payment_amount,
          payment_method: paymentData.payment_method || 'credit_card',
          payment_gateway: paymentData.payment_gateway || 'stripe',
          payment_token: paymentData.payment_token,
          metadata: {
            payment_plan_id: planId,
            scheduled_payment_id: scheduledPayment.id
          }
        },
        organizationId
      );

      // Update scheduled payment
      await db.query(
        `UPDATE payment_plan_payments 
         SET payment_status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [paymentResult_data.payment.id, scheduledPayment.id]
      );

      // Update payment plan balance
      const newBalance = Math.max(0, parseFloat(plan.remaining_balance) - paymentAmount);
      const nextPaymentDate = this.getNextScheduledPaymentDate(planId);
      let newStatus = 'active';

      if (newBalance <= 0) {
        newStatus = 'completed';
      }

      await db.query(
        `UPDATE payment_plans 
         SET remaining_balance = $1, next_payment_date = $2, status = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newBalance, nextPaymentDate, newStatus, planId]
      );

      // Log activity
      await this.logActivity(organizationId, plan.statement_id, planId, 'payment_plan_payment_received', {
        payment_plan_id: planId,
        payment_amount: paymentAmount,
        remaining_balance: newBalance
      }, {
        patient_name: plan.patient_name,
        patient_phone: plan.patient_phone,
        patient_email: plan.patient_email
      });

      return {
        payment_plan: {
          ...plan,
          remaining_balance: newBalance,
          status: newStatus,
          next_payment_date: nextPaymentDate
        },
        payment: paymentResult_data.payment
      };
    } catch (error) {
      console.error('Error processing payment plan payment:', error);
      throw error;
    }
  }

  /**
   * Get next scheduled payment date
   */
  async getNextScheduledPaymentDate(planId) {
    const result = await db.query(
      `SELECT scheduled_payment_date FROM payment_plan_payments 
       WHERE payment_plan_id = $1 AND payment_status = 'scheduled'
       ORDER BY scheduled_payment_date ASC
       LIMIT 1`,
      [planId]
    );

    return result.rows.length > 0 ? result.rows[0].scheduled_payment_date : null;
  }

  /**
   * Negotiate payment plan terms
   */
  async negotiatePaymentPlan(statementId, proposedTerms, organizationId) {
    try {
      // Validate proposed terms
      const validation = this.validatePaymentPlanTerms(proposedTerms);
      
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get statement
      const statementResult = await db.query(
        'SELECT * FROM patient_statements WHERE id = $1',
        [statementId]
      );

      if (statementResult.rows.length === 0) {
        throw new Error('Statement not found');
      }

      const statement = statementResult.rows[0];

      // Calculate terms summary
      const termsSummary = {
        total_amount: parseFloat(statement.balance_due),
        monthly_payment: proposedTerms.monthly_payment_amount,
        number_of_payments: proposedTerms.number_of_payments,
        total_payment_amount: proposedTerms.monthly_payment_amount * proposedTerms.number_of_payments,
        payment_frequency: proposedTerms.payment_frequency || 'monthly',
        start_date: proposedTerms.start_date || new Date()
      };

      return {
        proposed_terms: termsSummary,
        acceptance_required: true,
        message: `Proposed payment plan: $${termsSummary.monthly_payment.toFixed(2)} per month for ${termsSummary.number_of_payments} months (${termsSummary.payment_frequency}). Total: $${termsSummary.total_payment_amount.toFixed(2)}.`
      };
    } catch (error) {
      console.error('Error negotiating payment plan:', error);
      throw error;
    }
  }

  /**
   * Validate payment plan terms
   */
  validatePaymentPlanTerms(terms) {
    if (!terms.monthly_payment_amount || terms.monthly_payment_amount <= 0) {
      return { valid: false, error: 'Monthly payment amount must be greater than 0' };
    }

    if (!terms.number_of_payments || terms.number_of_payments <= 0) {
      return { valid: false, error: 'Number of payments must be greater than 0' };
    }

    if (terms.number_of_payments > 60) {
      return { valid: false, error: 'Payment plan cannot exceed 60 months' };
    }

    return { valid: true };
  }

  /**
   * Log activity
   */
  async logActivity(organizationId, statementId, paymentPlanId, activityType, metadata, patientInfo) {
    try {
      await db.query(
        `INSERT INTO collections_activity_log (
          organization_id, statement_id, payment_plan_id, activity_type, activity_description,
          patient_name, patient_phone, patient_email, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          organizationId,
          statementId,
          paymentPlanId,
          activityType,
          metadata.activity_description || `${activityType} for payment plan ${paymentPlanId}`,
          patientInfo.patient_name,
          patientInfo.patient_phone || null,
          patientInfo.patient_email || null,
          JSON.stringify(metadata)
        ]
      );
    } catch (error) {
      console.error('Error logging payment plan activity:', error);
    }
  }

  /**
   * Get payment plan functions for OpenAI function calling
   */
  getPaymentPlanFunctions() {
    return [
      {
        name: 'negotiate_payment_plan',
        description: 'Negotiate payment plan terms with a patient for an overdue balance. Use this when a patient wants to set up a payment plan.',
        parameters: {
          type: 'object',
          properties: {
            statement_id: {
              type: 'number',
              description: 'ID of the statement to create payment plan for'
            },
            monthly_payment_amount: {
              type: 'number',
              description: 'Monthly payment amount'
            },
            number_of_payments: {
              type: 'number',
              description: 'Number of payments (months)'
            },
            payment_frequency: {
              type: 'string',
              description: 'Payment frequency',
              enum: ['monthly', 'biweekly', 'weekly']
            },
            start_date: {
              type: 'string',
              description: 'Start date for payment plan (YYYY-MM-DD format)'
            }
          },
          required: ['statement_id', 'monthly_payment_amount', 'number_of_payments']
        }
      },
      {
        name: 'create_payment_plan',
        description: 'Create a payment plan after terms have been agreed upon by the patient. Use this after negotiating and confirming payment plan terms.',
        parameters: {
          type: 'object',
          properties: {
            statement_id: {
              type: 'number',
              description: 'ID of the statement to create payment plan for'
            },
            monthly_payment_amount: {
              type: 'number',
              description: 'Monthly payment amount'
            },
            number_of_payments: {
              type: 'number',
              description: 'Number of payments (months)'
            },
            payment_frequency: {
              type: 'string',
              description: 'Payment frequency',
              enum: ['monthly', 'biweekly', 'weekly']
            },
            start_date: {
              type: 'string',
              description: 'Start date for payment plan (YYYY-MM-DD format)'
            }
          },
          required: ['statement_id', 'monthly_payment_amount', 'number_of_payments']
        }
      }
    ];
  }
}

module.exports = new PaymentPlanService();

