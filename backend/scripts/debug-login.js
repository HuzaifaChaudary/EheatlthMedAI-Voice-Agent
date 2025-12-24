require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')
const bcrypt = require('bcryptjs')

async function debugLogin() {
  try {
    const testEmail = 'Hostingeraccess7@gmail.com'
    const testPassword = 'Admin123!'
    
    console.log('=== DEBUGGING LOGIN ===\n')
    console.log('Test Email:', testEmail)
    console.log('Test Password:', testPassword)
    console.log('')
    
    // Check exact email match
    const exactMatch = await db.query('SELECT id, email, role, is_active, password_hash FROM users WHERE email = $1', [testEmail])
    console.log('1. Exact email match:')
    console.log('   Found:', exactMatch.rows.length > 0)
    if (exactMatch.rows.length > 0) {
      const user = exactMatch.rows[0]
      console.log('   ID:', user.id)
      console.log('   Email:', JSON.stringify(user.email))
      console.log('   Email length:', user.email.length)
      console.log('   Role:', user.role)
      console.log('   Is Active:', user.is_active)
      console.log('   Has Password:', !!user.password_hash)
      
      if (user.password_hash) {
        const isValid = await bcrypt.compare(testPassword, user.password_hash)
        console.log('   Password Valid:', isValid)
      }
    }
    console.log('')
    
    // Check case-insensitive match
    const caseInsensitive = await db.query('SELECT id, email, role, is_active, password_hash FROM users WHERE LOWER(email) = LOWER($1)', [testEmail])
    console.log('2. Case-insensitive match:')
    console.log('   Found:', caseInsensitive.rows.length > 0)
    if (caseInsensitive.rows.length > 0) {
      const user = caseInsensitive.rows[0]
      console.log('   ID:', user.id)
      console.log('   Email in DB:', JSON.stringify(user.email))
      console.log('   Email matches test:', user.email === testEmail)
    }
    console.log('')
    
    // Check all users with similar email
    const similar = await db.query("SELECT id, email, role FROM users WHERE email LIKE '%hostinger%' OR email LIKE '%Hostinger%'")
    console.log('3. All users with "hostinger" in email:')
    similar.rows.forEach(u => {
      console.log(`   ID: ${u.id}, Email: ${JSON.stringify(u.email)}, Role: ${u.role}`)
    })
    console.log('')
    
    // Test normalizeEmail behavior
    const validator = require('express-validator')
    const normalized = validator.body('email').isEmail().normalizeEmail()
    console.log('4. Email normalization test:')
    console.log('   Original:', testEmail)
    // Can't easily test normalizeEmail without express request, but we know it lowercases
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

debugLogin()

