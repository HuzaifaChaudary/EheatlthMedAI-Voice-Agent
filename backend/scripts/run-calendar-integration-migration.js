/**
 * Run migration to add calendar_integration_id to ai_agents table
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env from backend directory
const envPath = path.join(__dirname, '..', '.env');
console.log('📁 Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Verify database config is loaded
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error('❌ Error: Database configuration not found in .env file');
  console.error('   Please ensure DATABASE_URL or DB_HOST/DB_USER/DB_NAME are set');
  process.exit(1);
}

const db = require('../config/database');

async function runMigration() {
  console.log('🔄 Running migration: Add calendar_integration_id to ai_agents table...\n');
  
  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '../config/add-calendar-integration-to-agents.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Migration SQL:');
    console.log(sql);
    console.log('\n');
    
    // Execute the migration
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Verification:');
    
    // Verify the column was added
    const checkResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ai_agents' 
      AND column_name = 'calendar_integration_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column calendar_integration_id exists in ai_agents table');
      console.log('   Type:', checkResult.rows[0].data_type);
      console.log('   Nullable:', checkResult.rows[0].is_nullable);
    } else {
      console.log('⚠️  Column not found (this might be normal if migration already ran)');
    }
    
    // Check if index exists
    const indexResult = await db.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'ai_agents' 
      AND indexname = 'idx_ai_agents_calendar_integration'
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Index idx_ai_agents_calendar_integration exists');
    } else {
      console.log('⚠️  Index not found');
    }
    
    console.log('\n✨ Migration complete! Agents can now have individual calendar integrations.');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Column or index already exists. Migration may have already been run.');
      console.log('   This is safe to ignore.');
    } else {
      console.error('❌ Migration failed:', error.message);
      console.error('   Error details:', error);
      process.exit(1);
    }
  } finally {
    // Close the database connection
    if (db.pool) {
      await db.pool.end();
    }
  }
}

runMigration();

