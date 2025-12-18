const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

async function runUpdates() {
  const client = await db.pool.connect();
  
  try {
    console.log('Running database updates...');
    console.log('Connecting to database...');
    
    // Test connection
    await client.query('SELECT NOW()');
    console.log('✓ Database connection successful!\n');
    
    const sqlFile = path.join(__dirname, '../config/db-updates.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the entire SQL file
    console.log('Executing SQL updates...\n');
    await client.query(sql);
    
    console.log('\n✓ Database updates completed successfully!');
    
    // Verify columns were added
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('reset_token', 'reset_token_expires', 'google_id', 'google_email', 'avatar_url')
      ORDER BY column_name;
    `);
    
    console.log('\nAdded columns to users table:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('\n✗ Update error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runUpdates();

