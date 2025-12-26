#!/bin/bash
# Reset password for chhuzaifaiftikhar@gmail.com

EMAIL="chhuzaifaiftikhar@gmail.com"
NEW_PASSWORD="Admin123!"

echo "🔐 Resetting password for: $EMAIL"
echo ""

# First, check if user exists
USER_CHECK=$(psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -t -c "SELECT id, email, role FROM users WHERE LOWER(email) = LOWER('$EMAIL');" 2>/dev/null)

if [ -z "$USER_CHECK" ] || [ "$USER_CHECK" = "" ]; then
    echo "❌ User not found: $EMAIL"
    echo ""
    echo "Available users:"
    psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -c "SELECT id, email, role FROM users ORDER BY id LIMIT 10;" 2>/dev/null
    exit 1
fi

echo "✅ User found:"
echo "$USER_CHECK"
echo ""

# Use Node.js to hash the password properly
cd "$(dirname "$0")"
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

(async () => {
  try {
    const email = '$EMAIL';
    const password = '$NEW_PASSWORD';
    
    // Get user ID
    const userResult = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER(\$1)', [email]);
    if (userResult.rows.length === 0) {
      console.error('User not found');
      process.exit(1);
    }
    
    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Update password
    await pool.query('UPDATE users SET password_hash = \$1 WHERE id = \$2', [passwordHash, userId]);
    
    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('   Email:', userEmail);
    console.log('   Password:', password);
    console.log('');
    console.log('🌐 Login at: http://localhost:3000/login');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
"

