/**
 * Check Admin User and Fix Login Issues
 * Verifies admin user exists and password, can reset if needed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function checkAdmin() {
  try {
    console.log('🔍 Checking admin users in database...\n');

    // Get all admin users
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active, password_hash, created_at FROM users WHERE role = $1 ORDER BY id',
      ['admin']
    );

    if (result.rows.length === 0) {
      console.log('❌ No admin users found in database!');
      console.log('\n💡 Create an admin user:');
      console.log('   node backend/scripts/create-admin.js admin@example.com Admin123 Admin User');
      process.exit(1);
    }

    console.log(`✅ Found ${result.rows.length} admin user(s):\n`);

    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. Admin User:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`   Has Password: ${user.password_hash ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    // Test the password from test scripts
    const testEmail = 'Hostingeraccess7@gmail.com';
    const testPassword = 'Admin123!';

    console.log(`\n🔐 Testing login credentials:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

    const userResult = await db.query(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = $1',
      [testEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found with that email!');
      console.log('\n💡 Available admin users above. Try logging in with one of those emails.');
      console.log('   Or reset password for an existing admin:');
      console.log(`   node backend/scripts/reset-password.js ${result.rows[0].email} NewPassword123`);
    } else {
      const user = userResult.rows[0];
      
      if (!user.is_active) {
        console.log('❌ Account is deactivated!');
        console.log('\n💡 Activate the account in database or create a new admin.');
      } else if (!user.password_hash) {
        console.log('❌ No password set! User must use Google OAuth or password needs to be set.');
        console.log('\n💡 Reset password:');
        console.log(`   node backend/scripts/reset-password.js ${user.email} NewPassword123`);
      } else {
        const isValid = await bcrypt.compare(testPassword, user.password_hash);
        
        if (isValid) {
          console.log('✅ Password is CORRECT!');
          console.log('\n💡 If login still fails, check:');
          console.log('   1. Frontend email normalization');
          console.log('   2. Backend logs for errors');
          console.log('   3. JWT token generation');
        } else {
          console.log('❌ Password is INCORRECT!');
          console.log('\n💡 Reset password:');
          console.log(`   node backend/scripts/reset-password.js ${user.email} NewPassword123`);
        }
      }
    }

    // Show first admin user as default
    if (result.rows.length > 0) {
      const firstAdmin = result.rows[0];
      console.log('\n📋 Quick Login Info:');
      console.log(`   Email: ${firstAdmin.email}`);
      console.log(`   Role: ${firstAdmin.role}`);
      console.log(`   Active: ${firstAdmin.is_active ? 'Yes' : 'No'}`);
      
      if (!firstAdmin.password_hash) {
        console.log('\n⚠️  This user has no password. Reset it:');
        console.log(`   node backend/scripts/reset-password.js ${firstAdmin.email} Admin123!`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (db.pool) {
      await db.pool.end();
    }
  }
}

checkAdmin();

