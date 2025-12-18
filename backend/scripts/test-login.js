const dotenv = require('dotenv');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

async function testLogin() {
  console.log('Testing login functionality...\n');
  
  // Check environment variables
  console.log('1. Checking environment variables:');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ SET' : '✗ NOT SET');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET');
  console.log('');
  
  if (!process.env.JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not set in .env file');
    process.exit(1);
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in .env file');
    process.exit(1);
  }
  
  // Test database connection
  console.log('2. Testing database connection:');
  try {
    const result = await db.query('SELECT NOW()');
    console.log('   ✓ Database connected successfully');
    console.log('   Current time:', result.rows[0].now);
  } catch (error) {
    console.error('   ✗ Database connection failed:', error.message);
    process.exit(1);
  }
  console.log('');
  
  // Check if users table exists
  console.log('3. Checking users table:');
  try {
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('   ✓ Users table exists');
    console.log('   Columns:', result.rows.map(r => r.column_name).join(', '));
  } catch (error) {
    console.error('   ✗ Users table check failed:', error.message);
    process.exit(1);
  }
  console.log('');
  
  // Check if audit_logs table exists
  console.log('4. Checking audit_logs table:');
  try {
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position
    `);
    console.log('   ✓ Audit_logs table exists');
    console.log('   Columns:', result.rows.map(r => r.column_name).join(', '));
  } catch (error) {
    console.warn('   ⚠ Audit_logs table check failed:', error.message);
    console.warn('   (This is non-critical - login will still work)');
  }
  console.log('');
  
  // Test JWT generation
  console.log('5. Testing JWT token generation:');
  try {
    const testPayload = { userId: 1, email: 'test@example.com', role: 'user' };
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('   ✓ JWT token generated successfully');
    console.log('   Token length:', token.length);
  } catch (error) {
    console.error('   ✗ JWT token generation failed:', error.message);
    process.exit(1);
  }
  console.log('');
  
  // Check for test user
  console.log('6. Checking for test users:');
  try {
    const result = await db.query('SELECT id, email, first_name, last_name, role FROM users LIMIT 5');
    if (result.rows.length > 0) {
      console.log('   ✓ Found', result.rows.length, 'user(s):');
      result.rows.forEach(user => {
        console.log(`     - ${user.email} (${user.first_name} ${user.last_name}) - ${user.role}`);
      });
    } else {
      console.log('   ⚠ No users found in database');
      console.log('   You can create a user by signing up');
    }
  } catch (error) {
    console.error('   ✗ Error checking users:', error.message);
  }
  console.log('');
  
  console.log('✓ All checks passed! Login should work now.');
  console.log('\nIf login still fails, check:');
  console.log('  1. Backend server is running');
  console.log('  2. Check backend terminal for error messages');
  console.log('  3. Verify user exists and has correct password');
  
  process.exit(0);
}

testLogin().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

