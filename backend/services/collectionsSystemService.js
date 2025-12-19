/**
 * Collections System Integration Service
 * Integration with external collections systems
 */

const db = require('../config/database');

class CollectionsSystemService {
  /**
   * Create collections case
   */
  async createCollectionsCase(statementId, organizationId, systemId = null) {
    try {
      // Get statement
      const statementResult = await db.query(
        'SELECT * FROM patient_statements WHERE id = $1',
        [statementId]
      );

      if (statementResult.rows.length === 0) {
        throw new Error('Statement not found');
      }

      const statement = statementResult.rows[0];

      // Calculate days overdue
      const dueDate = statement.due_date ? new Date(statement.due_date) : null;
      const today = new Date();
      const daysOverdue = dueDate ? Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))) : 0;

      // Create collections case
      const result = await db.query(
        `INSERT INTO collections_cases (
          organization_id, statement_id, patient_name, patient_phone, patient_email,
          balance_amount, days_overdue, case_status, collections_system_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          organizationId,
          statementId,
          statement.patient_name,
          statement.patient_phone,
          statement.patient_email,
          statement.balance_due,
          daysOverdue,
          'open',
          systemId
        ]
      );

      const caseRecord = result.rows[0];

      // Sync to external collections system if configured
      if (systemId) {
        await this.syncToExternalSystem(caseRecord, organizationId);
      }

      // Update statement status
      await db.query(
        'UPDATE patient_statements SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['sent_to_collections', statementId]
      );

      return caseRecord;
    } catch (error) {
      console.error('Error creating collections case:', error);
      throw error;
    }
  }

  /**
   * Sync case to external collections system
   */
  async syncToExternalSystem(caseRecord, organizationId) {
    try {
      const systemResult = await db.query(
        'SELECT * FROM collections_system_configs WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [caseRecord.collections_system_id, organizationId]
      );

      if (systemResult.rows.length === 0) {
        return; // No system configured
      }

      const system = systemResult.rows[0];

      // In production, integrate with actual collections system API
      // For now, return mock response
      const externalCaseId = `EXT-${caseRecord.id}-${Date.now()}`;

      // Update case with external ID
      await db.query(
        'UPDATE collections_cases SET external_case_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [externalCaseId, caseRecord.id]
      );

      return { external_case_id: externalCaseId };
    } catch (error) {
      console.error('Error syncing to external collections system:', error);
      throw error;
    }
  }

  /**
   * Get collections system functions for OpenAI function calling
   */
  getCollectionsSystemFunctions() {
    return [
      {
        name: 'create_collections_case',
        description: 'Create a collections case for an overdue balance. Use this when a balance is severely overdue and needs to be sent to collections.',
        parameters: {
          type: 'object',
          properties: {
            statement_id: {
              type: 'number',
              description: 'ID of the statement to send to collections'
            },
            collections_system_id: {
              type: 'number',
              description: 'ID of the collections system to use (optional)'
            }
          },
          required: ['statement_id']
        }
      }
    ];
  }
}

module.exports = new CollectionsSystemService();

