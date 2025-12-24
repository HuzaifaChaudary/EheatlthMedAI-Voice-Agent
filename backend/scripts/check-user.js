require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

async function checkUser() {
  try {
    const email = process.argv[2] || 'Hostingeraccess7@gmail.com'
    
    const result = await db.query(
      'SELECT id, email, role, is_active, password_hash IS NOT NULL as has_password, LENGTH(password_hash) as password_length FROM users WHERE email = $1',
      [email]
    )
    
    if (result.rows.length === 0) {
      console.log('❌ User not found:', email)
      process.exit(1)
    }
    
    const user = result.rows[0]
    console.log('\n✅ User found:')
    console.log('  ID:', user.id)
    console.log('  Email:', user.email)
    console.log('  Role:', user.role)
    console.log('  Is Active:', user.is_active)
    console.log('  Has Password:', user.has_password)
    console.log('  Password Hash Length:', user.password_length)
    
    // Test password verification
    if (user.has_password) {
      const bcrypt = require('bcryptjs')
      const passwordHash = await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
      const hash = passwordHash.rows[0].password_hash
      
      const testPasswords = ['TempPass123', 'Admin123!', 'Admin123']
      console.log('\n🔐 Password Tests:')
      for (const testPassword of testPasswords) {
        const isValid = await bcrypt.compare(testPassword, hash)
        console.log(`  "${testPassword}": ${isValid ? '✅ VALID' : '❌ INVALID'}`)
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkUser()

