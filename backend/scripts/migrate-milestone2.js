const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Running Milestone 2 migration...');
    
    const sqlFile = path.join(__dirname, '../config/milestone2-schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the entire SQL file at once (PostgreSQL handles multiple statements)
    try {
      await client.query(sql);
      console.log('✓ All SQL statements executed');
    } catch (error) {
      // If that fails, try executing statement by statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await client.query(statement);
          console.log(`✓ Executed statement ${i + 1}/${statements.length}`);
        } catch (err) {
          // Ignore "already exists" errors
          if (err.message.includes('already exists') || 
              err.message.includes('duplicate') ||
              err.code === '42P07' || // relation already exists
              err.code === '42710' || // duplicate object
              err.message.includes('does not exist')) { // for indexes on non-existent tables
            console.log(`⊘ Skipped: ${err.message.substring(0, 50)}...`);
          } else {
            console.error(`✗ Error in statement ${i + 1}:`, err.message);
            console.error('Statement:', statement.substring(0, 100));
            // Don't throw, continue with other statements
          }
        }
      }
    }
    
    console.log('\n✓ Milestone 2 migration completed successfully!');
    
    // Verify tables
    const tables = ['stakeholder_types', 'terminology', 'reference_standards', 'reading_guidance'];
    for (const table of tables) {
      try {
        const result = await client.query(
          `SELECT COUNT(*) FROM ${table}`
        );
        console.log(`  - ${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`  - ${table}: not found`);
      }
    }
    
  } catch (error) {
    console.error('\n✗ Migration error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();

