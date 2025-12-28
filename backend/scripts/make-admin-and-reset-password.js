const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend directory
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL or individual DB_* env vars not found.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function makeAdminAndResetPassword() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node backend/scripts/make-admin-and-reset-password.js <email> <newPassword>');
    process.exit(1);
  }

  const [email, newPassword] = args;

  console.log(`🔐 Making ${email} an admin and resetting password...`);

  try {
    // Check if user exists
    const userResult = await pool.query('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);

    if (userResult.rows.length === 0) {
      console.error('❌ Error: User not found.');
      console.log(`   Creating new admin user: ${email}`);
      
      // Create new admin user
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      const createResult = await pool.query(
        `INSERT INTO users (email, password_hash, role, is_active, first_name, last_name, created_at, updated_at)
         VALUES (LOWER($1), $2, 'admin', true, 'Admin', 'User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, email, role, is_active`,
        [email, passwordHash]
      );
      
      const newUser = createResult.rows[0];
      console.log(`✅ Created new admin user:`);
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Role: ${newUser.role}`);
      console.log(`   Active: ${newUser.is_active}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      const user = userResult.rows[0];
      
      // Update password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      // Update user to admin and reset password
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [passwordHash, 'admin', user.id]
      );
      
      console.log(`✅ Updated user:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: admin (updated)`);
      console.log(`   Active: true (updated)`);
      console.log(`   Password: ${newPassword} (reset)`);
    }

    console.log('\n🎉 User is now an admin with the new password!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

makeAdminAndResetPassword();

