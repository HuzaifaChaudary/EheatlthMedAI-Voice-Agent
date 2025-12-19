/**
 * Statement Explanation Service
 * Explains patient statements and bills
 */

const db = require('../config/database');

class StatementExplanationService {
  /**
   * Explain patient statement
   */
  async explainStatement(conversationId, statementData, organizationId) {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        statement_number,
        statement_date,
        total_amount,
        balance_due,
        statement_items,
        insurance_info
      } = statementData;

      // Validate required fields
      if (!patient_name || !statement_number || !total_amount) {
        throw new Error('Patient name, statement number, and total amount are required');
      }

      // Parse statement items if string
      const items = typeof statement_items === 'string' ? JSON.parse(statement_items) : statement_items;

      // Generate explanation
      const explanation = this.generateExplanation(statementData, items, insurance_info);

      // Check if statement already exists
      let statementResult = await db.query(
        'SELECT * FROM patient_statements WHERE statement_number = $1',
        [statement_number]
      );

      let statement;
      if (statementResult.rows.length > 0) {
        // Update existing statement
        statement = statementResult.rows[0];
        await db.query(
          `UPDATE patient_statements 
           SET balance_due = $1, statement_items = $2, insurance_info = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [
            balance_due || statement.balance_due,
            JSON.stringify(items),
            insurance_info ? JSON.stringify(insurance_info) : statement.insurance_info,
            statement.id
          ]
        );
      } else {
        // Create new statement
        const result = await db.query(
          `INSERT INTO patient_statements (
            conversation_id, patient_name, patient_phone, patient_email,
            statement_number, statement_date, total_amount, balance_due,
            statement_items, insurance_info, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            conversationId,
            patient_name,
            patient_phone || null,
            patient_email || null,
            statement_number,
            statement_date || new Date(),
            total_amount,
            balance_due || total_amount,
            JSON.stringify(items),
            insurance_info ? JSON.stringify(insurance_info) : null,
            balance_due > 0 ? 'pending' : 'paid'
          ]
        );
        statement = result.rows[0];
      }

      // Store line items
      await this.storeLineItems(statement.id, items);

      // Trigger webhook event
      try {
        const webhookService = require('./webhookService');
        await webhookService.deliverWebhookEvent('billing.statement_explained', {
          statement_id: statement.id,
          conversation_id: conversationId,
          statement_number: statement_number,
          balance_due: balance_due || total_amount,
          organization_id: organizationId
        }, organizationId);
      } catch (webhookError) {
        console.error('Error delivering billing.statement_explained webhook:', webhookError);
      }

      return {
        statement: statement,
        explanation: explanation
      };
    } catch (error) {
      console.error('Error explaining statement:', error);
      throw error;
    }
  }

  /**
   * Generate explanation for statement
   */
  generateExplanation(statementData, items, insuranceInfo) {
    let explanation = `Statement Explanation for ${statementData.statement_number}\n\n`;
    
    explanation += `Statement Date: ${new Date(statementData.statement_date || new Date()).toLocaleDateString()}\n`;
    explanation += `Total Amount: $${parseFloat(statementData.total_amount).toFixed(2)}\n`;
    explanation += `Balance Due: $${parseFloat(statementData.balance_due || statementData.total_amount).toFixed(2)}\n\n`;

    if (insuranceInfo) {
      explanation += `Insurance Information:\n`;
      if (insuranceInfo.provider) explanation += `  Provider: ${insuranceInfo.provider}\n`;
      if (insuranceInfo.claim_number) explanation += `  Claim Number: ${insuranceInfo.claim_number}\n`;
      if (insuranceInfo.insurance_paid) explanation += `  Insurance Paid: $${parseFloat(insuranceInfo.insurance_paid).toFixed(2)}\n`;
      if (insuranceInfo.patient_responsible) explanation += `  Your Responsibility: $${parseFloat(insuranceInfo.patient_responsible).toFixed(2)}\n`;
      explanation += `\n`;
    }

    if (items && Array.isArray(items) && items.length > 0) {
      explanation += `Statement Items:\n`;
      items.forEach((item, index) => {
        explanation += `  ${index + 1}. ${item.description || item.item_description || 'Service'}\n`;
        if (item.service_date) explanation += `     Date: ${new Date(item.service_date).toLocaleDateString()}\n`;
        if (item.quantity) explanation += `     Quantity: ${item.quantity}\n`;
        if (item.unit_price) explanation += `     Unit Price: $${parseFloat(item.unit_price).toFixed(2)}\n`;
        explanation += `     Amount: $${parseFloat(item.total_price || item.amount || 0).toFixed(2)}\n`;
        if (item.insurance_paid) explanation += `     Insurance Paid: $${parseFloat(item.insurance_paid).toFixed(2)}\n`;
        if (item.patient_responsible) explanation += `     Your Responsibility: $${parseFloat(item.patient_responsible).toFixed(2)}\n`;
        explanation += `\n`;
      });
    }

    explanation += `\nPayment Options:\n`;
    explanation += `  - Pay online through our secure payment portal\n`;
    explanation += `  - Pay by phone\n`;
    explanation += `  - Mail a check\n`;
    explanation += `  - Set up a payment plan\n`;

    if (statementData.balance_due > 0) {
      explanation += `\nYour current balance is $${parseFloat(statementData.balance_due).toFixed(2)}. `;
      if (statementData.due_date) {
        const dueDate = new Date(statementData.due_date);
        const today = new Date();
        if (dueDate < today) {
          explanation += `This payment is overdue. Please contact us to arrange payment.`;
        } else {
          explanation += `Payment is due by ${dueDate.toLocaleDateString()}.`;
        }
      }
    }

    return explanation;
  }

  /**
   * Store line items in normalized table
   */
  async storeLineItems(statementId, items) {
    if (!items || !Array.isArray(items)) return;

    // Delete existing line items for this statement
    await db.query('DELETE FROM statement_line_items WHERE statement_id = $1', [statementId]);

    // Insert new line items
    for (const item of items) {
      await db.query(
        `INSERT INTO statement_line_items (
          statement_id, item_description, service_date, quantity,
          unit_price, total_price, insurance_paid, patient_responsible
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          statementId,
          item.description || item.item_description || 'Service',
          item.service_date || null,
          item.quantity || 1,
          item.unit_price || null,
          item.total_price || item.amount || 0,
          item.insurance_paid || 0,
          item.patient_responsible || (item.total_price || item.amount || 0)
        ]
      );
    }
  }

  /**
   * Get statement explanation functions for OpenAI function calling
   */
  getStatementExplanationFunctions() {
    return [
      {
        name: 'explain_statement',
        description: 'Explain a patient statement or bill. Use this when a patient asks about their bill, statement, or charges.',
        parameters: {
          type: 'object',
          properties: {
            statement_number: {
              type: 'string',
              description: 'Statement or invoice number'
            },
            statement_date: {
              type: 'string',
              description: 'Date of the statement (YYYY-MM-DD format)'
            },
            total_amount: {
              type: 'number',
              description: 'Total amount on the statement'
            },
            balance_due: {
              type: 'number',
              description: 'Current balance due'
            },
            statement_items: {
              type: 'array',
              description: 'Array of line items on the statement',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  service_date: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number' },
                  total_price: { type: 'number' },
                  insurance_paid: { type: 'number' },
                  patient_responsible: { type: 'number' }
                }
              }
            },
            insurance_info: {
              type: 'object',
              description: 'Insurance information related to this statement'
            },
            due_date: {
              type: 'string',
              description: 'Payment due date (YYYY-MM-DD format)'
            }
          },
          required: ['statement_number', 'total_amount']
        }
      }
    ];
  }
}

module.exports = new StatementExplanationService();

