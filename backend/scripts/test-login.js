require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const db = require('../config/database')

async function testLogin() {
  try {
    const email = 'Hostingeraccess7@gmail.com'
    const password = 'Admin123!'
    
    console.log('Testing login with:')
    console.log('  Email:', email)
    console.log('  Password:', password)
    console.log('')
    
    // Simulate login logic from auth.js
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active, google_id FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      console.log('❌ User not found')
      process.exit(1)
    }

    const user = result.rows[0]
    console.log('✅ User found:')
    console.log('  ID:', user.id)
    console.log('  Email:', user.email)
    console.log('  Role:', user.role)
    console.log('  Is Active:', user.is_active)
    console.log('  Has Password Hash:', !!user.password_hash)
    console.log('  Has Google ID:', !!user.google_id)
    console.log('')

    if (!user.is_active) {
      console.log('❌ Account is deactivated')
      process.exit(1)
    }

    if (!user.password_hash) {
      console.log('❌ No password hash - user must use Google OAuth')
      process.exit(1)
    }

    // Test password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    console.log('🔐 Password Verification:')
    console.log('  Password Valid:', isValidPassword)
    
    if (!isValidPassword) {
      console.log('❌ Invalid password')
      process.exit(1)
    }

    console.log('')
    console.log('✅ LOGIN SHOULD SUCCEED!')
    console.log('')
    console.log('If login is still failing, check:')
    console.log('  1. Email normalization in frontend')
    console.log('  2. Request body format')
    console.log('  3. Backend logs for errors')
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testLogin()
