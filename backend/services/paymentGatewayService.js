/**
 * Payment Gateway Service
 * Handles payment processing through various gateways (Stripe, PayPal, etc.)
 */

const db = require('../config/database');
const crypto = require('crypto');

class PaymentGatewayService {
  /**
   * Process payment through gateway
   */
  async processPayment(conversationId, paymentData, organizationId) {
    try {
      const {
        statement_id,
        patient_name,
        patient_phone,
        patient_email,
        payment_amount,
        payment_method,
        payment_gateway,
        payment_token, // Token from frontend (Stripe token, PayPal order ID, etc.)
        billing_address,
        metadata
      } = paymentData;

      // Validate required fields
      if (!patient_name || !payment_amount || !payment_method || !payment_gateway) {
        throw new Error('Patient name, payment amount, payment method, and payment gateway are required');
      }

      // Get payment gateway configuration
      const gatewayConfig = await this.getGatewayConfig(payment_gateway, organizationId);

      if (!gatewayConfig) {
        throw new Error(`Payment gateway ${payment_gateway} is not configured`);
      }

      // Process payment based on gateway
      let paymentResult;
      switch (payment_gateway.toLowerCase()) {
        case 'stripe':
          paymentResult = await this.processStripePayment(paymentData, gatewayConfig);
          break;
        case 'paypal':
          paymentResult = await this.processPayPalPayment(paymentData, gatewayConfig);
          break;
        case 'square':
          paymentResult = await this.processSquarePayment(paymentData, gatewayConfig);
          break;
        default:
          throw new Error(`Unsupported payment gateway: ${payment_gateway}`);
      }

      // Create payment record
      const result = await db.query(
        `INSERT INTO payments (
          conversation_id, statement_id, patient_name, patient_phone, patient_email,
          payment_amount, payment_method, payment_gateway, gateway_transaction_id,
          payment_status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          conversationId,
          statement_id || null,
          patient_name,
          patient_phone || null,
          patient_email || null,
          payment_amount,
          payment_method,
          payment_gateway,
          paymentResult.transaction_id,
          paymentResult.status,
          metadata ? JSON.stringify(metadata) : null
        ]
      );

      const payment = result.rows[0];

      // Update statement balance if statement_id provided
      if (statement_id) {
        await this.updateStatementBalance(statement_id, payment_amount);
      }

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('billing.payment_processed', {
          payment_id: payment.id,
          conversation_id: conversationId,
          statement_id: statement_id,
          payment_amount: payment_amount,
          payment_status: paymentResult.status,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering billing.payment_processed webhook:', webhookError);
      }

      return {
        payment: payment,
        gateway_response: paymentResult
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Get payment gateway configuration
   */
  async getGatewayConfig(gatewayName, organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM payment_gateway_configs 
         WHERE gateway_name = $1 
         AND (organization_id = $2 OR organization_id IS NULL)
         AND is_active = true
         ORDER BY organization_id DESC NULLS LAST
         LIMIT 1`,
        [gatewayName, organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0];

      // Decrypt sensitive fields (in production, use proper encryption)
      // For now, we'll assume they're stored securely
      return {
        id: config.id,
        gateway_name: config.gateway_name,
        gateway_type: config.gateway_type,
        api_key: config.api_key_encrypted, // In production, decrypt this
        api_secret: config.api_secret_encrypted, // In production, decrypt this
        webhook_secret: config.webhook_secret_encrypted, // In production, decrypt this
        merchant_id: config.merchant_id,
        is_test_mode: config.is_test_mode,
        configuration: typeof config.configuration === 'string' 
          ? JSON.parse(config.configuration) 
          : config.configuration
      };
    } catch (error) {
      console.error('Error getting gateway config:', error);
      return null;
    }
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment(paymentData, gatewayConfig) {
    try {
      // In production, use Stripe SDK
      // For now, we'll simulate the payment
      const stripe = require('stripe')(gatewayConfig.api_key);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(paymentData.payment_amount * 100), // Convert to cents
        currency: 'usd',
        payment_method: paymentData.payment_token,
        confirm: true,
        description: `Payment for ${paymentData.patient_name}`,
        metadata: {
          patient_name: paymentData.patient_name,
          patient_email: paymentData.patient_email || '',
          statement_id: paymentData.statement_id || '',
          conversation_id: paymentData.conversation_id || ''
        }
      });

      return {
        transaction_id: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'processing',
        gateway_response: paymentIntent
      };
    } catch (error) {
      console.error('Stripe payment error:', error);
      
      // In development/test mode, return mock success
      if (gatewayConfig.is_test_mode && process.env.NODE_ENV !== 'production') {
        console.log('Using mock Stripe payment (test mode)');
        return {
          transaction_id: `pi_mock_${Date.now()}`,
          status: 'completed',
          gateway_response: { mock: true }
        };
      }

      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * Process PayPal payment
   */
  async processPayPalPayment(paymentData, gatewayConfig) {
    try {
      // In production, use PayPal SDK
      // For now, we'll simulate the payment
      const axios = require('axios');

      // PayPal API call would go here
      // For now, return mock response in test mode
      if (gatewayConfig.is_test_mode && process.env.NODE_ENV !== 'production') {
        console.log('Using mock PayPal payment (test mode)');
        return {
          transaction_id: `PAYPAL-${Date.now()}`,
          status: 'completed',
          gateway_response: { mock: true }
        };
      }

      // Real PayPal implementation would use PayPal SDK
      throw new Error('PayPal integration requires PayPal SDK configuration');
    } catch (error) {
      console.error('PayPal payment error:', error);
      throw new Error(`PayPal payment failed: ${error.message}`);
    }
  }

  /**
   * Process Square payment
   */
  async processSquarePayment(paymentData, gatewayConfig) {
    try {
      // In production, use Square SDK
      // For now, return mock response in test mode
      if (gatewayConfig.is_test_mode && process.env.NODE_ENV !== 'production') {
        console.log('Using mock Square payment (test mode)');
        return {
          transaction_id: `SQ-${Date.now()}`,
          status: 'completed',
          gateway_response: { mock: true }
        };
      }

      throw new Error('Square integration requires Square SDK configuration');
    } catch (error) {
      console.error('Square payment error:', error);
      throw new Error(`Square payment failed: ${error.message}`);
    }
  }

  /**
   * Update statement balance after payment
   */
  async updateStatementBalance(statementId, paymentAmount) {
    try {
      const statementResult = await db.query(
        'SELECT balance_due FROM patient_statements WHERE id = $1',
        [statementId]
      );

      if (statementResult.rows.length === 0) {
        return;
      }

      const currentBalance = parseFloat(statementResult.rows[0].balance_due);
      const newBalance = Math.max(0, currentBalance - paymentAmount);

      let newStatus = 'pending';
      if (newBalance === 0) {
        newStatus = 'paid';
      } else if (newBalance < currentBalance) {
        newStatus = 'partial';
      }

      await db.query(
        `UPDATE patient_statements 
         SET balance_due = $1, status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newBalance, newStatus, statementId]
      );
    } catch (error) {
      console.error('Error updating statement balance:', error);
    }
  }

  /**
   * Get payment gateway functions for OpenAI function calling
   */
  getPaymentGatewayFunctions() {
    return [
      {
        name: 'process_payment',
        description: 'Process a payment for a patient. Use this when a patient wants to pay their bill or statement.',
        parameters: {
          type: 'object',
          properties: {
            statement_id: {
              type: 'number',
              description: 'ID of the statement being paid (if applicable)'
            },
            payment_amount: {
              type: 'number',
              description: 'Amount to be paid'
            },
            payment_method: {
              type: 'string',
              description: 'Payment method',
              enum: ['credit_card', 'debit_card', 'bank_transfer', 'check', 'cash']
            },
            payment_gateway: {
              type: 'string',
              description: 'Payment gateway to use',
              enum: ['stripe', 'paypal', 'square']
            },
            payment_token: {
              type: 'string',
              description: 'Payment token from payment gateway (provided by frontend)'
            },
            billing_address: {
              type: 'object',
              description: 'Billing address for the payment'
            }
          },
          required: ['payment_amount', 'payment_method', 'payment_gateway', 'payment_token']
        }
      }
    ];
  }
}

module.exports = new PaymentGatewayService();

