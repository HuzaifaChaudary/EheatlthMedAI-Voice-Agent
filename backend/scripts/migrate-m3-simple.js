const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Running Milestone 3 migration...');
    
    const sqlFile = path.join(__dirname, '../config/milestone3-schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the entire SQL file
    await client.query(sql);
    
    console.log('✓ Migration successful');
    
    // Verify tables
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('portals', 'sdks', 'stt_configurations', 'nlu_configurations', 'tts_configurations', 'consent_records', 'call_recordings', 'hl7_connectors', 'fhir_connectors', 'ehr_systems', 'webhook_events', 'access_policies', 'report_templates', 'generated_reports', 'voice_channels')"
    );
    console.log('Tables created:', result.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();

