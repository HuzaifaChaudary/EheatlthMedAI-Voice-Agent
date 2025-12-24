/**
 * Script to reset a user's password
 * Usage: node scripts/reset-password.js <email> <newPassword>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const db = require('../config/database')

async function resetPassword() {
  try {
    const args = process.argv.slice(2)
    
    if (args.length < 2) {
      console.log('Usage: node scripts/reset-password.js <email> <newPassword>')
      console.log('Example: node scripts/reset-password.js admin@ehealthmed.ai NewPassword123')
      process.exit(1)
    }

    const [email, password] = args

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Error: Invalid email format')
      process.exit(1)
    }

    // Validate password
    if (password.length < 6) {
      console.error('Error: Password must be at least 6 characters long')
      process.exit(1)
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id, email, role FROM users WHERE email = $1', [email])
    if (existingUser.rows.length === 0) {
      console.error(`Error: User with email ${email} not found`)
      process.exit(1)
    }

    const user = existingUser.rows[0]

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)
    
    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email]
    )
    
    console.log(`✓ Password reset successfully for user:`)
    console.log(`  Email: ${email}`)
    console.log(`  Role: ${user.role}`)
    console.log(`\nNew login credentials:`)
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)

    process.exit(0)
  } catch (error) {
    console.error('Error resetting password:', error)
    process.exit(1)
  }
}

resetPassword()

