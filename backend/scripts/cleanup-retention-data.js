require('dotenv').config();
const db = require('../config/database');

async function cleanupRetentionData() {
  try {
    console.log('Starting data retention cleanup...');

    const policies = await db.query(`
      SELECT * FROM retention_policies 
      WHERE auto_delete = true
    `);

    console.log(`Found ${policies.rows.length} retention policies with auto-delete enabled`);

    for (const policy of policies.rows) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

        let deleteQuery;
        let deletedCount = 0;

        switch (policy.data_type) {
          case 'call_logs':
            deleteQuery = `
              DELETE FROM call_logs 
              WHERE organization_id = $1 
                AND created_at < $2
            `;
            const callLogsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
            deletedCount = callLogsResult.rowCount || 0;
            break;

          case 'transcripts':
            deleteQuery = `
              UPDATE conversations 
              SET transcript = NULL, updated_at = CURRENT_TIMESTAMP
              WHERE organization_id = $1 
                AND updated_at < $2
                AND transcript IS NOT NULL
            `;
            const transcriptsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
            deletedCount = transcriptsResult.rowCount || 0;
            break;

          case 'recordings':
            deleteQuery = `
              DELETE FROM call_recordings 
              WHERE organization_id = $1 
                AND created_at < $2
            `;
            const recordingsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
            deletedCount = recordingsResult.rowCount || 0;
            break;

          case 'audit_logs':
            deleteQuery = `
              DELETE FROM audit_logs 
              WHERE organization_id = $1 
                AND created_at < $2
            `;
            const auditResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
            deletedCount = auditResult.rowCount || 0;
            break;

          default:
            console.log(`Unknown data type: ${policy.data_type}, skipping...`);
            continue;
        }

        await db.query(`
          UPDATE retention_policies 
          SET last_cleanup_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [policy.id]);

        await db.query(`
          INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
          VALUES (1, 'DATA_RETENTION_CLEANUP', 'retention_policies', $1, $2)
        `, [
          policy.id,
          JSON.stringify({
            data_type: policy.data_type,
            organization_id: policy.organization_id,
            cutoff_date: cutoffDate.toISOString(),
            deleted_count: deletedCount,
            retention_days: policy.retention_days
          })
        ]);

        console.log(`Cleaned up ${deletedCount} records of type ${policy.data_type} for organization ${policy.organization_id}`);
      } catch (error) {
        console.error(`Error cleaning up ${policy.data_type} for organization ${policy.organization_id}:`, error);
      }
    }

    console.log('Data retention cleanup completed');
  } catch (error) {
    console.error('Error in data retention cleanup:', error);
    process.exit(1);
  }
}

async function cleanupSpecificDataType(dataType, organizationId = null) {
  try {
    console.log(`Starting cleanup for data type: ${dataType}`);

    let policyQuery = 'SELECT * FROM retention_policies WHERE data_type = $1';
    const params = [dataType];

    if (organizationId) {
      policyQuery += ' AND organization_id = $2';
      params.push(organizationId);
    }

    const policies = await db.query(policyQuery, params);

    if (policies.rows.length === 0) {
      console.log(`No retention policy found for data type: ${dataType}`);
      return;
    }

    const policy = policies.rows[0];

    if (!policy.auto_delete) {
      console.log(`Auto-delete is disabled for ${dataType}, skipping...`);
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

    let deleteQuery;
    let deletedCount = 0;

    switch (dataType) {
      case 'call_logs':
        deleteQuery = `
          DELETE FROM call_logs 
          WHERE organization_id = $1 
            AND created_at < $2
        `;
        const callLogsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
        deletedCount = callLogsResult.rowCount || 0;
        break;

      case 'transcripts':
        deleteQuery = `
          UPDATE conversations 
          SET transcript = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE organization_id = $1 
            AND updated_at < $2
            AND transcript IS NOT NULL
        `;
        const transcriptsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
        deletedCount = transcriptsResult.rowCount || 0;
        break;

      case 'recordings':
        deleteQuery = `
          DELETE FROM call_recordings 
          WHERE organization_id = $1 
            AND created_at < $2
        `;
        const recordingsResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
        deletedCount = recordingsResult.rowCount || 0;
        break;

      case 'audit_logs':
        deleteQuery = `
          DELETE FROM audit_logs 
          WHERE organization_id = $1 
            AND created_at < $2
        `;
        const auditResult = await db.query(deleteQuery, [policy.organization_id, cutoffDate]);
        deletedCount = auditResult.rowCount || 0;
        break;

      default:
        console.log(`Unknown data type: ${dataType}`);
        return;
    }

    await db.query(`
      UPDATE retention_policies 
      SET last_cleanup_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [policy.id]);

    console.log(`Cleaned up ${deletedCount} records of type ${dataType}`);
  } catch (error) {
    console.error(`Error cleaning up ${dataType}:`, error);
    throw error;
  }
}

if (require.main === module) {
  const dataType = process.argv[2];
  const organizationId = process.argv[3] || null;

  if (dataType) {
    cleanupSpecificDataType(dataType, organizationId ? parseInt(organizationId) : null)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    cleanupRetentionData().then(() => process.exit(0)).catch(() => process.exit(1));
  }
}

module.exports = { cleanupRetentionData, cleanupSpecificDataType };

