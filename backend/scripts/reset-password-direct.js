/**
 * Script to reset a user's password (direct database connection)
 * Usage: node scripts/reset-password-direct.js <email> <newPassword>
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Direct database connection (same as psql command)
const pool = new Pool({
  connectionString: 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

async function resetPassword() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('Usage: node scripts/reset-password-direct.js <email> <newPassword>');
      console.log('Example: node scripts/reset-password-direct.js chhuzaifaiftikhar@gmail.com Admin123!');
      process.exit(1);
    }

    const [email, password] = args;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Error: Invalid email format');
      process.exit(1);
    }

    // Validate password
    if (password.length < 6) {
      console.error('Error: Password must be at least 6 characters long');
      process.exit(1);
    }

    console.log(`🔐 Resetting password for: ${email}`);
    console.log('');

    // Check if user exists
    const existingUser = await pool.query('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existingUser.rows.length === 0) {
      console.error(`❌ Error: User with email ${email} not found`);
      console.log('');
      console.log('💡 Available users:');
      const allUsers = await pool.query('SELECT id, email, role FROM users ORDER BY id LIMIT 10');
      allUsers.rows.forEach(u => {
        console.log(`   - ${u.email} (${u.role})`);
      });
      process.exit(1);
    }

    const user = existingUser.rows[0];
    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log('');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Update password (use exact email from database)
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, user.id]
    );
    
    console.log(`✅ Password reset successfully!`);
    console.log('');
    console.log(`📋 Login Credentials:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log(`🌐 Login at: http://localhost:3000/login`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Database connection refused. Make sure PostgreSQL is running.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetPassword();

