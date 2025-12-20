/**
 * Scheduled Report Service
 * Handles scheduled report generation and email delivery
 */

const db = require('../config/database');
const reportService = require('./reportService');
const reminderService = require('./reminderService');
const cron = require('node-cron');

class ScheduledReportService {
  /**
   * Schedule a report
   */
  async scheduleReport(templateId, schedule, recipients, organizationId) {
    try {
      // Update template with schedule
      await db.query(
        `UPDATE report_templates 
         SET schedule = $1, recipients = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND organization_id = $4`,
        [JSON.stringify(schedule), recipients, templateId, organizationId]
      );

      // Register cron job if schedule is provided
      if (schedule && schedule.frequency) {
        await this.registerCronJob(templateId, schedule, organizationId);
      }

      return { success: true, message: 'Report scheduled successfully' };
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  /**
   * Register cron job for scheduled report
   */
  async registerCronJob(templateId, schedule, organizationId) {
    try {
      const cronExpression = this.parseScheduleToCron(schedule);
      
      if (!cronExpression) {
        throw new Error('Invalid schedule format');
      }

      // Store cron job info (in production, use a proper job queue)
      const jobId = `report-${templateId}-${organizationId}`;
      
      // Schedule the job
      cron.schedule(cronExpression, async () => {
        await this.generateAndSendScheduledReport(templateId, organizationId);
      }, {
        scheduled: true,
        timezone: schedule.timezone || 'America/New_York'
      });

      return { jobId, cronExpression };
    } catch (error) {
      console.error('Error registering cron job:', error);
      throw error;
    }
  }

  /**
   * Parse schedule to cron expression
   */
  parseScheduleToCron(schedule) {
    if (!schedule.frequency) return null;

    switch (schedule.frequency.toLowerCase()) {
      case 'daily':
        return schedule.time ? `0 ${schedule.time.split(':')[1]} ${schedule.time.split(':')[0]} * * *` : '0 0 * * *';
      case 'weekly':
        const dayOfWeek = schedule.day_of_week || 0; // 0 = Sunday
        return schedule.time ? `0 ${schedule.time.split(':')[1]} ${schedule.time.split(':')[0]} * * ${dayOfWeek}` : `0 0 * * ${dayOfWeek}`;
      case 'monthly':
        const dayOfMonth = schedule.day_of_month || 1;
        return schedule.time ? `0 ${schedule.time.split(':')[1]} ${schedule.time.split(':')[0]} ${dayOfMonth} * *` : `0 0 ${dayOfMonth} * *`;
      default:
        return null;
    }
  }

  /**
   * Generate and send scheduled report
   */
  async generateAndSendScheduledReport(templateId, organizationId) {
    try {
      // Get template
      const templateResult = await db.query(
        'SELECT * FROM report_templates WHERE id = $1 AND organization_id = $2',
        [templateId, organizationId]
      );

      if (templateResult.rows.length === 0) {
        throw new Error('Template not found');
      }

      const template = templateResult.rows[0];

      // Get default parameters (date range for last period)
      const parameters = this.getDefaultParameters(template.schedule);

      // Generate report
      const reportData = await reportService.fetchReportData(template, {
        ...parameters,
        organization_id: organizationId
      });

      // Create report record
      const reportResult = await db.query(
        `INSERT INTO generated_reports (
          template_id, organization_id, generated_by, parameters, status, format
        ) VALUES ($1, $2, NULL, $3, 'generating', $4)
        RETURNING *`,
        [templateId, organizationId, JSON.stringify(parameters), template.format || 'pdf']
      );

      const report = reportResult.rows[0];

      // Generate report file
      let reportBuffer;
      let filename;
      let contentType;

      switch (template.format) {
        case 'xlsx':
        case 'excel':
          reportBuffer = await reportService.generateExcelReport(template, reportData);
          filename = `report-${report.id}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          reportBuffer = await reportService.generatePDFReport(template, reportData);
          filename = `report-${report.id}.pdf`;
          contentType = 'application/pdf';
          break;
        default:
          throw new Error(`Unsupported format: ${template.format}`);
      }

      // Update report status
      await db.query(
        `UPDATE generated_reports 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, report_url = $1
         WHERE id = $2`,
        [`/api/reports/${report.id}/download`, report.id]
      );

      // Send to recipients
      if (template.recipients && Array.isArray(template.recipients) && template.recipients.length > 0) {
        await this.sendReportToRecipients(report, template, reportBuffer, filename, contentType, organizationId);
      }

      return { success: true, report_id: report.id };
    } catch (error) {
      console.error('Error generating scheduled report:', error);
      
      // Update report status to failed
      try {
        await db.query(
          `UPDATE generated_reports SET status = 'failed' WHERE template_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [templateId, organizationId]
        );
      } catch (updateError) {
        console.error('Error updating report status:', updateError);
      }

      throw error;
    }
  }

  /**
   * Get default parameters based on schedule
   */
  getDefaultParameters(schedule) {
    const scheduleData = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
    const endDate = new Date();
    let startDate = new Date();

    if (scheduleData.frequency === 'daily') {
      startDate.setDate(startDate.getDate() - 1);
    } else if (scheduleData.frequency === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (scheduleData.frequency === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Send report to recipients
   */
  async sendReportToRecipients(report, template, reportBuffer, filename, contentType, organizationId) {
    try {
      const recipients = typeof template.recipients === 'string' 
        ? JSON.parse(template.recipients) 
        : template.recipients;

      for (const recipient of recipients) {
        if (recipient.type === 'email' && recipient.email) {
          await this.sendReportEmail(recipient.email, template, report, reportBuffer, filename, contentType, organizationId);
        }
      }
    } catch (error) {
      console.error('Error sending report to recipients:', error);
      throw error;
    }
  }

  /**
   * Send report via email
   */
  async sendReportEmail(email, template, report, reportBuffer, filename, contentType, organizationId) {
    try {
      const emailTransporter = await reminderService.getEmailTransporter(organizationId);
      
      if (!emailTransporter) {
        console.warn('Email transporter not configured. Report will not be sent.');
        return;
      }

      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@ehealthmedai.com',
        to: email,
        subject: `Scheduled Report: ${template.name}`,
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>Scheduled Report: ${template.name}</h2>
              <p>Your scheduled report has been generated successfully.</p>
              <p><strong>Report ID:</strong> ${report.id}</p>
              <p><strong>Generated:</strong> ${new Date(report.completed_at).toLocaleString()}</p>
              <p><strong>Format:</strong> ${template.format.toUpperCase()}</p>
              <p>Please find the report attached to this email.</p>
              <p>If you have any questions, please contact support.</p>
            </body>
          </html>
        `,
        attachments: [{
          filename: filename,
          content: reportBuffer,
          contentType: contentType
        }]
      };

      const info = await emailTransporter.sendMail(mailOptions);
      console.log('Report email sent successfully:', info.messageId);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending report email:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled reports
   */
  async getScheduledReports(organizationId) {
    try {
      const result = await db.query(
        `SELECT * FROM report_templates 
         WHERE organization_id = $1 AND schedule IS NOT NULL
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return result.rows.map(template => ({
        ...template,
        schedule: typeof template.schedule === 'string' ? JSON.parse(template.schedule) : template.schedule,
        recipients: typeof template.recipients === 'string' ? JSON.parse(template.recipients) : template.recipients
      }));
    } catch (error) {
      console.error('Error getting scheduled reports:', error);
      return [];
    }
  }
}

module.exports = new ScheduledReportService();

