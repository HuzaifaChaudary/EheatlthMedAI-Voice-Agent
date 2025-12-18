/**
 * Report Generation Service
 * Handles Excel and PDF report generation
 */

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../config/database');

class ReportService {
  /**
   * Generate Excel report
   */
  async generateExcelReport(template, reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(template.name || 'Report');

    // Set up styles
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { vertical: 'middle', horizontal: 'center' }
    };

    const titleStyle = {
      font: { bold: true, size: 16 }
    };

    // Add title
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = template.name || 'Report';
    worksheet.getCell('A1').style = titleStyle;

    // Add metadata
    worksheet.getCell('A3').value = 'Generated:';
    worksheet.getCell('B3').value = new Date().toLocaleString();
    worksheet.getCell('A4').value = 'Type:';
    worksheet.getCell('B4').value = template.type || 'General';

    // Add data rows
    let startRow = 6;
    
    if (reportData && reportData.length > 0) {
      // Get headers from first data object
      const headers = Object.keys(reportData[0]);
      
      // Add header row
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(startRow, index + 1);
        cell.value = header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        cell.style = headerStyle;
      });

      // Add data rows
      reportData.forEach((row, rowIndex) => {
        headers.forEach((header, colIndex) => {
          const cell = worksheet.getCell(startRow + rowIndex + 1, colIndex + 1);
          const value = row[header];
          
          // Handle different data types
          if (value instanceof Date) {
            cell.value = value;
            cell.numFmt = 'mm/dd/yyyy hh:mm:ss';
          } else if (typeof value === 'number') {
            cell.value = value;
          } else {
            cell.value = value || '';
          }
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        column.width = Math.max(
          headers[index]?.length || 10,
          ...reportData.map(row => String(row[headers[index]] || '').length)
        ) + 5;
      });
    } else {
      // No data message
      worksheet.getCell(startRow, 1).value = 'No data available for this report.';
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Generate PDF report
   */
  async generatePDFReport(template, reportData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(template.name || 'Report', 50, 50);
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, 50, 80);
        doc.text(`Type: ${template.type || 'General'}`, 50, 95);

        // Add horizontal line
        doc.moveTo(50, 120).lineTo(550, 120).stroke();

        let yPosition = 140;

        if (reportData && reportData.length > 0) {
          // Get headers
          const headers = Object.keys(reportData[0]);

          // Table header
          doc.fontSize(12).font('Helvetica-Bold');
          let xPosition = 50;
          const colWidth = 470 / headers.length;

          headers.forEach((header, index) => {
            doc.text(
              header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              xPosition + (index * colWidth),
              yPosition,
              { width: colWidth - 10, align: 'left' }
            );
          });

          yPosition += 20;
          doc.moveTo(50, yPosition - 5).lineTo(550, yPosition - 5).stroke();

          // Table data
          doc.fontSize(10).font('Helvetica');
          reportData.forEach((row, rowIndex) => {
            // Check if we need a new page
            if (yPosition > 750) {
              doc.addPage();
              yPosition = 50;
            }

            xPosition = 50;
            headers.forEach((header, colIndex) => {
              const value = row[header];
              const displayValue = value instanceof Date 
                ? value.toLocaleString() 
                : (value !== null && value !== undefined ? String(value) : '');
              
              doc.text(
                displayValue,
                xPosition + (colIndex * colWidth),
                yPosition,
                { width: colWidth - 10, align: 'left' }
              );
            });

            yPosition += 15;

            // Add separator line every 5 rows
            if ((rowIndex + 1) % 5 === 0) {
              doc.moveTo(50, yPosition - 2).lineTo(550, yPosition - 2).strokeColor('#CCCCCC').stroke();
            }
          });
        } else {
          doc.fontSize(12).text('No data available for this report.', 50, yPosition);
        }

        // Footer
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8)
            .text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 30, { align: 'center' });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Fetch report data based on template query config
   */
  async fetchReportData(template, parameters = {}) {
    try {
      const queryConfig = typeof template.query_config === 'string' 
        ? JSON.parse(template.query_config) 
        : template.query_config || {};

      let data = [];

      // Based on report type, fetch appropriate data
      switch (template.type) {
        case 'call_analytics':
          data = await this.fetchCallAnalytics(queryConfig, parameters);
          break;
        case 'agent_performance':
          data = await this.fetchAgentPerformance(queryConfig, parameters);
          break;
        case 'billing_summary':
          data = await this.fetchBillingSummary(queryConfig, parameters);
          break;
        case 'conversation_log':
          data = await this.fetchConversationLog(queryConfig, parameters);
          break;
        default:
          // Generic query
          if (queryConfig.query) {
            const result = await db.query(queryConfig.query, queryConfig.params || []);
            data = result.rows;
          }
      }

      return data;
    } catch (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }
  }

  /**
   * Fetch call analytics data
   */
  async fetchCallAnalytics(queryConfig, parameters) {
    const { start_date, end_date, organization_id } = parameters;
    
    const query = `
      SELECT 
        DATE(c.created_at) as date,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN c.status = 'failed' THEN 1 END) as failed_calls,
        AVG(c.duration) as avg_duration,
        SUM(c.duration) as total_duration,
        SUM(c.cost) as total_cost
      FROM conversations c
      WHERE c.created_at >= COALESCE($1, CURRENT_DATE - INTERVAL '30 days')
        AND c.created_at <= COALESCE($2, CURRENT_TIMESTAMP)
        AND ($3::integer IS NULL OR c.metadata->>'organization_id' = $3::text)
      GROUP BY DATE(c.created_at)
      ORDER BY date DESC
    `;

    const result = await db.query(query, [start_date, end_date, organization_id]);
    return result.rows;
  }

  /**
   * Fetch agent performance data
   */
  async fetchAgentPerformance(queryConfig, parameters) {
    const { start_date, end_date, organization_id } = parameters;

    const query = `
      SELECT 
        aa.id,
        aa.name,
        aa.type,
        COUNT(c.id) as total_calls,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_calls,
        AVG(c.duration) as avg_duration,
        SUM(c.cost) as total_cost,
        AVG(c.cost) as avg_cost
      FROM conversations c
      JOIN ai_agents aa ON c.agent_id = aa.id
      WHERE c.created_at >= COALESCE($1, CURRENT_DATE - INTERVAL '30 days')
        AND c.created_at <= COALESCE($2, CURRENT_TIMESTAMP)
        AND ($3::integer IS NULL OR c.metadata->>'organization_id' = $3::text)
      GROUP BY aa.id, aa.name, aa.type
      ORDER BY total_calls DESC
    `;

    const result = await db.query(query, [start_date, end_date, organization_id]);
    return result.rows;
  }

  /**
   * Fetch billing summary data
   */
  async fetchBillingSummary(queryConfig, parameters) {
    // Placeholder - implement based on billing schema
    return [];
  }

  /**
   * Fetch conversation log data
   */
  async fetchConversationLog(queryConfig, parameters) {
    const { start_date, end_date, organization_id, limit = 100 } = parameters;

    const query = `
      SELECT 
        c.id,
        c.created_at,
        c.status,
        c.duration,
        c.cost,
        aa.name as agent_name,
        aa.type as agent_type
      FROM conversations c
      JOIN ai_agents aa ON c.agent_id = aa.id
      WHERE c.created_at >= COALESCE($1, CURRENT_DATE - INTERVAL '30 days')
        AND c.created_at <= COALESCE($2, CURRENT_TIMESTAMP)
        AND ($3::integer IS NULL OR c.metadata->>'organization_id' = $3::text)
      ORDER BY c.created_at DESC
      LIMIT $4
    `;

    const result = await db.query(query, [start_date, end_date, organization_id, limit]);
    return result.rows;
  }
}

module.exports = new ReportService();

