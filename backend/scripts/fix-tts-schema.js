/**
 * Script to fix TTS configuration schema - increase field sizes
 * Usage: node scripts/fix-tts-schema.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

async function fixTtsSchema() {
  try {
    console.log('Fixing TTS configuration schema...')

    // Alter pitch column to allow larger values (e.g., -20 to +20 semitones)
    await db.query(`
      ALTER TABLE tts_configurations 
      ALTER COLUMN pitch TYPE DECIMAL(5, 2)
    `)
    console.log('✓ Updated pitch column to DECIMAL(5, 2)')

    // Alter speaking_rate column to allow values up to 4.0 (though 3,2 should work)
    await db.query(`
      ALTER TABLE tts_configurations 
      ALTER COLUMN speaking_rate TYPE DECIMAL(4, 2)
    `)
    console.log('✓ Updated speaking_rate column to DECIMAL(4, 2)')

    console.log('\n✓ TTS schema updated successfully!')
    process.exit(0)
  } catch (error) {
    if (error.code === '42701' || error.message.includes('does not exist')) {
      console.error('Error: Column may not exist or already has correct type')
      console.error('Details:', error.message)
    } else {
      console.error('Error fixing TTS schema:', error)
    }
    process.exit(1)
  }
}

fixTtsSchema()

