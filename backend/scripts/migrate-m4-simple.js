const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Running Milestone 4 migration...');
    
    const sqlFile = path.join(__dirname, '../config/milestone4-schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the entire SQL file
    await client.query(sql);
    
    console.log('✓ Migration successful');
    
    // Verify tables
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('operational_assumptions', 'constraints', 'requirements', 'requirement_dependencies', 'constraint_violations', 'requirement_verifications')"
    );
    console.log('Tables created:', result.rows.map(r => r.table_name));
    
    // Check record counts
    for (const row of result.rows) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
        console.log(`  - ${row.table_name}: ${countResult.rows[0].count} records`);
      } catch (e) {
        // Table might not have records yet
      }
    }
    
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

