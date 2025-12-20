require('dotenv').config();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running telephony schema migration...');
    
    const sqlPath = path.join(__dirname, '../config/milestone-telephony-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await db.query(sql);
    console.log('✅ Telephony schema migration completed successfully!');
    
    // Verify tables exist
    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sms_messages', 'voicemails', 'call_transcriptions')
    `);
    console.log('Tables verified:', tables.rows.map(r => r.table_name));
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
}

runMigration();

