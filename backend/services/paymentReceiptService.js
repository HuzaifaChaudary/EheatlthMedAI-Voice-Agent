/**
 * Payment Receipt Service
 * Generates and sends payment receipts
 */

const db = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PaymentReceiptService {
  /**
   * Generate payment receipt
   */
  async generateReceipt(paymentId, organizationId) {
    try {
      // Get payment information
      const paymentResult = await db.query(
        `SELECT p.*, ps.statement_number 
         FROM payments p
         LEFT JOIN patient_statements ps ON p.statement_id = ps.id
         WHERE p.id = $1`,
        [paymentId]
      );

      if (paymentResult.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const payment = paymentResult.rows[0];

      // Generate receipt number
      const receiptNumber = `RCP-${Date.now()}-${paymentId}`;

      // Generate PDF receipt
      const pdfPath = await this.generatePDFReceipt(payment, receiptNumber, organizationId);

      // Generate HTML receipt
      const htmlReceipt = this.generateHTMLReceipt(payment, receiptNumber);

      // Create receipt record
      const result = await db.query(
        `INSERT INTO payment_receipts (
          payment_id, receipt_number, receipt_date, patient_name,
          patient_email, patient_phone, payment_amount, payment_method,
          receipt_pdf_url, receipt_html
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          paymentId,
          receiptNumber,
          new Date(),
          payment.patient_name,
          payment.patient_email || null,
          payment.patient_phone || null,
          payment.payment_amount,
          payment.payment_method,
          pdfPath,
          htmlReceipt
        ]
      );

      const receipt = result.rows[0];

      // Update payment record
      await db.query(
        'UPDATE payments SET receipt_generated = true, receipt_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [pdfPath, paymentId]
      );

      // Send receipt via email and SMS
      const sendResult = await this.sendReceipt(receipt, organizationId);

      // Update receipt record with send status
      await db.query(
        `UPDATE payment_receipts 
         SET sent_via_email = $1, sent_via_sms = $2, 
             email_sent_at = $3, sms_sent_at = $4
         WHERE id = $5`,
        [
          sendResult.email_sent,
          sendResult.sms_sent,
          sendResult.email_sent ? new Date() : null,
          sendResult.sms_sent ? new Date() : null,
          receipt.id
        ]
      );

      // Update payment record
      await db.query(
        `UPDATE payments 
         SET receipt_sent_via_email = $1, receipt_sent_via_sms = $2
         WHERE id = $3`,
        [sendResult.email_sent, sendResult.sms_sent, paymentId]
      );

      return {
        receipt: receipt,
        pdf_url: pdfPath,
        email_sent: sendResult.email_sent,
        sms_sent: sendResult.sms_sent
      };
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  }

  /**
   * Generate PDF receipt
   */
  async generatePDFReceipt(payment, receiptNumber, organizationId) {
    return new Promise((resolve, reject) => {
      try {
        // Create receipts directory if it doesn't exist
        const receiptsDir = path.join(__dirname, '../../receipts');
        if (!fs.existsSync(receiptsDir)) {
          fs.mkdirSync(receiptsDir, { recursive: true });
        }

        const filename = `receipt-${receiptNumber}.pdf`;
        const filepath = path.join(receiptsDir, filename);
        const doc = new PDFDocument({ margin: 50 });

        // Pipe to file
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('Payment Receipt', { align: 'center' });
        doc.moveDown();

        // Receipt details
        doc.fontSize(12);
        doc.text(`Receipt Number: ${receiptNumber}`);
        doc.text(`Receipt Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Patient information
        doc.fontSize(14).text('Patient Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Name: ${payment.patient_name}`);
        if (payment.patient_email) doc.text(`Email: ${payment.patient_email}`);
        if (payment.patient_phone) doc.text(`Phone: ${payment.patient_phone}`);
        doc.moveDown();

        // Payment information
        doc.fontSize(14).text('Payment Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Payment Amount: $${parseFloat(payment.payment_amount).toFixed(2)}`);
        doc.text(`Payment Method: ${payment.payment_method.replace('_', ' ').toUpperCase()}`);
        doc.text(`Payment Date: ${new Date(payment.payment_date).toLocaleDateString()}`);
        if (payment.statement_number) {
          doc.text(`Statement Number: ${payment.statement_number}`);
        }
        if (payment.gateway_transaction_id) {
          doc.text(`Transaction ID: ${payment.gateway_transaction_id}`);
        }
        doc.moveDown();

        // Footer
        doc.fontSize(10)
          .text('Thank you for your payment!', { align: 'center' })
          .text('This is an official receipt for your records.', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          // Return relative URL path
          resolve(`/receipts/${filename}`);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate HTML receipt
   */
  generateHTMLReceipt(payment, receiptNumber) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 2px solid #333; }
          .detail { margin: 5px 0; }
          .amount { font-size: 18px; font-weight: bold; color: #0066cc; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment Receipt</h1>
          <p>Receipt Number: ${receiptNumber}</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="section">
          <div class="section-title">Patient Information</div>
          <div class="detail">Name: ${payment.patient_name}</div>
          ${payment.patient_email ? `<div class="detail">Email: ${payment.patient_email}</div>` : ''}
          ${payment.patient_phone ? `<div class="detail">Phone: ${payment.patient_phone}</div>` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">Payment Information</div>
          <div class="detail amount">Amount: $${parseFloat(payment.payment_amount).toFixed(2)}</div>
          <div class="detail">Payment Method: ${payment.payment_method.replace('_', ' ').toUpperCase()}</div>
          <div class="detail">Payment Date: ${new Date(payment.payment_date).toLocaleDateString()}</div>
          ${payment.statement_number ? `<div class="detail">Statement Number: ${payment.statement_number}</div>` : ''}
          ${payment.gateway_transaction_id ? `<div class="detail">Transaction ID: ${payment.gateway_transaction_id}</div>` : ''}
        </div>
        
        <div class="footer">
          <p>Thank you for your payment!</p>
          <p>This is an official receipt for your records.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send receipt via email and SMS
   */
  async sendReceipt(receipt, organizationId) {
    const reminderService = require('./reminderService');
    const result = { email_sent: false, sms_sent: false };

    // Send email
    if (receipt.patient_email) {
      try {
        const emailResult = await reminderService.sendEmailReminder(
          {
            patient_name: receipt.patient_name,
            patient_email: receipt.patient_email,
            appointment_date: receipt.receipt_date,
            appointment_type: 'Payment Receipt'
          },
          organizationId,
          `Payment Receipt - ${receipt.receipt_number}`,
          receipt.receipt_html
        );

        result.email_sent = emailResult.success || false;
      } catch (error) {
        console.error('Error sending receipt email:', error);
      }
    }

    // Send SMS
    if (receipt.patient_phone) {
      try {
        const smsMessage = `Payment Receipt ${receipt.receipt_number}: $${parseFloat(receipt.payment_amount).toFixed(2)} paid on ${new Date(receipt.receipt_date).toLocaleDateString()}. Thank you!`;
        
        const smsResult = await reminderService.sendSMSReminder(
          {
            patient_name: receipt.patient_name,
            patient_phone: receipt.patient_phone,
            appointment_date: receipt.receipt_date,
            appointment_type: 'Payment Receipt'
          },
          organizationId,
          smsMessage
        );

        result.sms_sent = smsResult.success || false;
      } catch (error) {
        console.error('Error sending receipt SMS:', error);
      }
    }

    return result;
  }

  /**
   * Get payment receipt functions for OpenAI function calling
   */
  getReceiptFunctions() {
    return [
      {
        name: 'generate_payment_receipt',
        description: 'Generate and send a payment receipt to a patient after payment is processed. Use this after a payment is successfully completed.',
        parameters: {
          type: 'object',
          properties: {
            payment_id: {
              type: 'number',
              description: 'ID of the payment to generate receipt for'
            }
          },
          required: ['payment_id']
        }
      }
    ];
  }
}

module.exports = new PaymentReceiptService();

