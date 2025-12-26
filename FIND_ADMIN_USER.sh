#!/bin/bash
# Find Admin Users in Database

echo "🔍 Finding admin users in local database..."
echo ""

# Query for admin users
psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -c "SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE role = 'admin' ORDER BY id;"

echo ""
echo "📝 Based on test scripts, the admin user is likely:"
echo "   Email: Hostingeraccess7@gmail.com"
echo "   Password: Admin123!"
echo ""
echo "⚠️  Note: Passwords are hashed in database, so we can't retrieve the plain password."
echo "   If the password above doesn't work, you can:"
echo "   1. Use password reset: /forgot-password"
echo "   2. Or reset password via script: node backend/scripts/reset-password.js"
