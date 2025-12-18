/**
 * Script to add expires_at column to encryption_keys table
 * Usage: node scripts/add-expires-at-to-encryption-keys.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

async function addExpiresAtColumn() {
  try {
    console.log('Adding expires_at column to encryption_keys table...')

    // Check if column already exists
    const checkResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'encryption_keys' AND column_name = 'expires_at'
    `)

    if (checkResult.rows.length > 0) {
      console.log('✓ Column expires_at already exists')
      process.exit(0)
      return
    }

    // Add the column
    await db.query(`
      ALTER TABLE encryption_keys 
      ADD COLUMN expires_at TIMESTAMP
    `)
    console.log('✓ Added expires_at column to encryption_keys table')

    console.log('\n✓ Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error adding expires_at column:', error)
    process.exit(1)
  }
}

addExpiresAtColumn()

