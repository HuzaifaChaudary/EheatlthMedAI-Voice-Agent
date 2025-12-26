/**
 * Check for tables that might be missing organization_id column
 * 
 * This script checks all tables that the code tries to use with organization_id
 * and identifies which ones are missing it in the database.
 * 
 * Usage: node backend/scripts/check-missing-organization-id.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

// Tables that code uses with organization_id
const tablesToCheck = [
  'conversations',
  'appointments',
  'audit_logs',
  'sms_messages',
  'voicemails',
  'call_transcriptions',
  'failed_login_attempts',
  'blocked_ips',
  'security_incidents',
  'generated_reports',
  'report_templates',
  'grm_integrations',
  'hl7_connectors',
  'fhir_connectors',
  'ehr_systems',
  'portals',
  'sdks',
  'voice_channels',
  'stt_configurations',
  'nlu_configurations',
  'tts_configurations',
  'consent_records',
  'baa_agreements',
  'retention_policies',
  'srs_documents',
  'reminder_configurations'
];

async function checkTables() {
  try {
    console.log('🔍 Checking tables for missing organization_id column...\n');

    const results = {
      hasColumn: [],
      missingColumn: [],
      tableNotExists: []
    };

    for (const tableName of tablesToCheck) {
      try {
        // Check if table exists
        const tableExists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [tableName]);

        if (!tableExists.rows[0].exists) {
          results.tableNotExists.push(tableName);
          continue;
        }

        // Check if organization_id column exists
        const columnExists = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name = 'organization_id'
        `, [tableName]);

        if (columnExists.rows.length > 0) {
          results.hasColumn.push(tableName);
        } else {
          results.missingColumn.push(tableName);
        }
      } catch (error) {
        console.error(`Error checking ${tableName}:`, error.message);
      }
    }

    // Print results
    console.log('✅ Tables WITH organization_id column:');
    if (results.hasColumn.length > 0) {
      results.hasColumn.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('   (none)');
    }

    console.log('\n❌ Tables MISSING organization_id column:');
    if (results.missingColumn.length > 0) {
      results.missingColumn.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('   (none - all tables have organization_id!)');
    }

    console.log('\n⚠️  Tables that DO NOT EXIST:');
    if (results.tableNotExists.length > 0) {
      results.tableNotExists.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('   (none)');
    }

    console.log('\n📊 Summary:');
    console.log(`   Total checked: ${tablesToCheck.length}`);
    console.log(`   Has column: ${results.hasColumn.length}`);
    console.log(`   Missing column: ${results.missingColumn.length}`);
    console.log(`   Table not exists: ${results.tableNotExists.length}`);

    if (results.missingColumn.length > 0) {
      console.log('\n⚠️  WARNING: Some tables are missing organization_id column!');
      console.log('   These tables may cause errors if code tries to use organization_id.');
    } else {
      console.log('\n✅ All existing tables have organization_id column!');
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkTables();

