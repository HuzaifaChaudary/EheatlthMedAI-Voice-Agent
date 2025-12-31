/**
 * Migration Script: Normalize Phone Numbers to E.164 Format
 * This script normalizes all phone numbers in the database to E.164 format
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const { normalizePhoneNumber } = require('../utils/phoneUtils');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

async function normalizePhoneNumbers() {
  console.log('🔄 Starting phone number normalization...\n');
  
  try {
    // Get all phone numbers
    const result = await pool.query('SELECT id, phone_number FROM phone_numbers');
    const phoneNumbers = result.rows;
    
    console.log(`Found ${phoneNumbers.length} phone number(s) to normalize\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const phone of phoneNumbers) {
      const original = phone.phone_number;
      const normalized = normalizePhoneNumber(original);
      
      if (original === normalized) {
        console.log(`✓ ${original} - Already normalized`);
        skipped++;
        continue;
      }
      
      try {
        await pool.query(
          'UPDATE phone_numbers SET phone_number = $1 WHERE id = $2',
          [normalized, phone.id]
        );
        console.log(`✓ ${original} → ${normalized} (ID: ${phone.id})`);
        updated++;
      } catch (error) {
        console.error(`✗ Error updating ${original}: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n✅ Normalization complete:`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
    
  } catch (error) {
    console.error('❌ Error normalizing phone numbers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  normalizePhoneNumbers()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { normalizePhoneNumbers };
