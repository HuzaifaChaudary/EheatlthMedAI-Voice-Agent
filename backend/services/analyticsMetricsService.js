/**
 * Analytics Metrics Service
 * Calculates advanced metrics: average handle time, scheduling success rate, collections recovered
 */

const db = require('../config/database');

class AnalyticsMetricsService {
  /**
   * Calculate average handle time
   */
  async calculateAverageHandleTime(organizationId, startDate, endDate) {
    try {
      let query = `
        SELECT 
          AVG(duration_seconds) as avg_handle_time_seconds,
          AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_completed_handle_time,
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_calls
        FROM call_logs
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (organizationId) {
        paramCount++;
        query += ` AND organization_id = $${paramCount}`;
        params.push(organizationId);
      } else {
        query += ` AND organization_id IS NULL`;
      }

      if (startDate) {
        paramCount++;
        query += ` AND started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND started_at <= $${paramCount}`;
        params.push(endDate + ' 23:59:59');
      }

      const result = await db.query(query, params);
      const row = result.rows[0] || {};

      return {
        avg_handle_time_seconds: parseFloat(row.avg_handle_time_seconds || 0),
        avg_completed_handle_time_seconds: parseFloat(row.avg_completed_handle_time || 0),
        total_calls: parseInt(row.total_calls || 0),
        completed_calls: parseInt(row.completed_calls || 0),
        avg_handle_time_formatted: this.formatDuration(parseFloat(row.avg_handle_time_seconds || 0)),
        avg_completed_handle_time_formatted: this.formatDuration(parseFloat(row.avg_completed_handle_time || 0))
      };
    } catch (error) {
      console.error('Error calculating average handle time:', error);
      return {
        avg_handle_time_seconds: 0,
        avg_completed_handle_time_seconds: 0,
        total_calls: 0,
        completed_calls: 0,
        avg_handle_time_formatted: '0s',
        avg_completed_handle_time_formatted: '0s'
      };
    }
  }

  /**
   * Calculate scheduling success rate
   */
  async calculateSchedulingSuccessRate(organizationId, startDate, endDate) {
    try {
      // Get all appointments
      let query = `
        SELECT 
          COUNT(*) as total_booking_attempts,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'confirmed', 'completed')) as successful_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
          COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
          COUNT(DISTINCT DATE(appointment_date)) as unique_days_with_bookings
        FROM appointments
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        params.push(endDate + ' 23:59:59');
      }

      const result = await db.query(query, params);
      const row = result.rows[0] || {};

      const totalAttempts = parseInt(row.total_booking_attempts || 0);
      const successful = parseInt(row.successful_bookings || 0);
      const successRate = totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0;

      return {
        total_booking_attempts: totalAttempts,
        successful_bookings: successful,
        cancelled_bookings: parseInt(row.cancelled_bookings || 0),
        no_shows: parseInt(row.no_shows || 0),
        success_rate_percentage: parseFloat(successRate.toFixed(2)),
        unique_days_with_bookings: parseInt(row.unique_days_with_bookings || 0)
      };
    } catch (error) {
      console.error('Error calculating scheduling success rate:', error);
      return {
        total_booking_attempts: 0,
        successful_bookings: 0,
        cancelled_bookings: 0,
        no_shows: 0,
        success_rate_percentage: 0,
        unique_days_with_bookings: 0
      };
    }
  }

  /**
   * Calculate collections recovered
   */
  async calculateCollectionsRecovered(organizationId, startDate, endDate) {
    try {
      // Get all completed payments
      let query = `
        SELECT 
          COUNT(DISTINCT id) as total_payments,
          SUM(payment_amount) as total_recovered,
          AVG(payment_amount) as avg_payment_amount,
          COUNT(DISTINCT statement_id) as statements_paid,
          COUNT(*) FILTER (WHERE payment_status = 'completed') as completed_payments,
          COUNT(*) FILTER (WHERE payment_status = 'failed') as failed_payments
        FROM payments
        WHERE payment_status = 'completed'
      `;
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND payment_date >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND payment_date <= $${paramCount}`;
        params.push(endDate + ' 23:59:59');
      }

      const result = await db.query(query, params);
      const row = result.rows[0] || {};

      // Get overdue balances
      const overdueQuery = `
        SELECT 
          SUM(balance_due) as total_overdue_before,
          COUNT(*) as overdue_statements
        FROM patient_statements
        WHERE status IN ('overdue', 'partial')
          AND due_date < CURRENT_DATE
      `;

      const overdueResult = await db.query(overdueQuery, []);
      const overdueRow = overdueResult.rows[0] || {};

      const totalRecovered = parseFloat(row.total_recovered || 0);
      const totalOverdue = parseFloat(overdueRow.total_overdue_before || 0);

      return {
        total_recovered: totalRecovered,
        total_payments: parseInt(row.total_payments || 0),
        avg_payment_amount: parseFloat(row.avg_payment_amount || 0),
        statements_paid: parseInt(row.statements_paid || 0),
        completed_payments: parseInt(row.completed_payments || 0),
        failed_payments: parseInt(row.failed_payments || 0),
        total_overdue_before: totalOverdue,
        overdue_statements: parseInt(overdueRow.overdue_statements || 0),
        recovery_rate_percentage: totalOverdue > 0
          ? parseFloat(((totalRecovered / (totalRecovered + totalOverdue)) * 100).toFixed(2))
          : totalRecovered > 0 ? 100 : 0
      };
    } catch (error) {
      console.error('Error calculating collections recovered:', error);
      return {
        total_recovered: 0,
        total_payments: 0,
        avg_payment_amount: 0,
        statements_paid: 0,
        completed_payments: 0,
        failed_payments: 0,
        total_overdue_before: 0,
        overdue_statements: 0,
        recovery_rate_percentage: 0
      };
    }
  }

  /**
   * Get call volume trends
   */
  async getCallVolumeTrends(organizationId, startDate, endDate, period = 'daily') {
    try {
      let dateFormat;
      switch (period) {
        case 'hourly':
          dateFormat = "DATE_TRUNC('hour', started_at)";
          break;
        case 'weekly':
          dateFormat = "DATE_TRUNC('week', started_at)";
          break;
        case 'monthly':
          dateFormat = "DATE_TRUNC('month', started_at)";
          break;
        case 'daily':
        default:
          dateFormat = "DATE(started_at)";
      }

      let query = `
        SELECT 
          ${dateFormat} as period,
          COUNT(*) as call_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
          SUM(duration_seconds) as total_duration,
          AVG(duration_seconds) as avg_duration,
          SUM(cost) as total_cost
        FROM call_logs
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (organizationId) {
        paramCount++;
        query += ` AND organization_id = $${paramCount}`;
        params.push(organizationId);
      } else {
        query += ` AND organization_id IS NULL`;
      }

      if (startDate) {
        paramCount++;
        query += ` AND started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND started_at <= $${paramCount}`;
        params.push(endDate + ' 23:59:59');
      }

      query += ` GROUP BY ${dateFormat} ORDER BY period DESC`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting call volume trends:', error);
      return [];
    }
  }

  /**
   * Format duration helper
   */
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

module.exports = new AnalyticsMetricsService();

