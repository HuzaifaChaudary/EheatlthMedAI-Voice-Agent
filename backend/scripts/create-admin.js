/**
 * Script to create an admin user account
 * Usage: node scripts/create-admin.js <email> <password> <firstName> <lastName>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const db = require('../config/database')

async function createAdmin() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2)
    
    if (args.length < 4) {
      console.log('Usage: node scripts/create-admin.js <email> <password> <firstName> <lastName>')
      console.log('Example: node scripts/create-admin.js admin@ehealthmed.ai Admin123 Admin User')
      process.exit(1)
    }

    const [email, password, firstName, lastName] = args

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

    // Check if user already exists
    const existingUser = await db.query('SELECT id, email, role FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0]
      if (user.role === 'admin') {
        console.log(`✓ Admin user with email ${email} already exists`)
        console.log(`  User ID: ${user.id}`)
        console.log(`  Email: ${user.email}`)
        console.log(`  Role: ${user.role}`)
        process.exit(0)
      } else {
        // Update existing user to admin
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)
        
        await db.query(
          'UPDATE users SET password_hash = $1, role = $2, first_name = $3, last_name = $4, is_active = $5 WHERE email = $6',
          [passwordHash, 'admin', firstName, lastName, true, email]
        )
        
        console.log(`✓ Updated existing user to admin:`)
        console.log(`  Email: ${email}`)
        console.log(`  Name: ${firstName} ${lastName}`)
        console.log(`  Role: admin`)
        process.exit(0)
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    // Get or create default organization
    let orgId = null
    try {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1')
      if (orgResult.rows.length > 0) {
        orgId = orgResult.rows[0].id
      } else {
        // Create default organization
        const newOrg = await db.query(
          `INSERT INTO organizations (name, subdomain, is_active, subscription_tier, max_agents, max_users, max_calls_per_month)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          ['Default Organization', 'default', true, 'enterprise', 100, 1000, 100000]
        )
        orgId = newOrg.rows[0].id
        console.log(`✓ Created default organization (ID: ${orgId})`)
      }
    } catch (error) {
      // Organization table might not exist, continue without it
      console.log('Note: Organization not set (table may not exist)')
    }

    // Create admin user
    let result
    if (orgId) {
      result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, first_name, last_name, role, is_active, created_at`,
        [email, passwordHash, firstName, lastName, 'admin', true, orgId]
      )
    } else {
      result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role, is_active, created_at`,
        [email, passwordHash, firstName, lastName, 'admin', true]
      )
    }

    const user = result.rows[0]

    console.log('\n✓ Admin user created successfully!')
    console.log('\nAccount Details:')
    console.log(`  User ID: ${user.id}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Name: ${user.first_name} ${user.last_name}`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Status: ${user.is_active ? 'Active' : 'Inactive'}`)
    console.log(`  Created: ${new Date(user.created_at).toLocaleString()}`)
    console.log('\nYou can now login with:')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)
    console.log('\n⚠️  Please change your password after first login!')

    process.exit(0)
  } catch (error) {
    console.error('Error creating admin user:', error)
    if (error.code === '23505') {
      console.error('Error: An account with this email already exists')
    } else {
      console.error('Error details:', error.message)
    }
    process.exit(1)
  }
}

createAdmin()

