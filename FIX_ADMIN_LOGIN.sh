#!/bin/bash
# Fix Admin Login - Check and Reset Password

echo "🔧 Fixing Admin Login Issue"
echo "============================"
echo ""

# Step 1: Check existing admin users
echo "1️⃣ Checking existing admin users..."
psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -c "SELECT id, email, first_name, last_name, role, is_active FROM users WHERE role = 'admin' ORDER BY id;" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Could not connect to database. Make sure PostgreSQL is running."
    exit 1
fi

echo ""
echo "2️⃣ Resetting password for Hostingeraccess7@gmail.com..."
echo "   (This will work even if email is stored in different case)"
echo ""

# Reset password using Node.js script
cd "$(dirname "$0")"
node backend/scripts/reset-password.js Hostingeraccess7@gmail.com Admin123! 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Password reset successful!"
    echo ""
    echo "📋 Login Credentials:"
    echo "   Email: Hostingeraccess7@gmail.com"
    echo "   Password: Admin123!"
    echo ""
    echo "🌐 Try logging in at: http://localhost:3000/login"
else
    echo ""
    echo "⚠️  User might not exist. Creating new admin user..."
    echo ""
    node backend/scripts/create-admin.js Hostingeraccess7@gmail.com Admin123! Admin User 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Admin user created!"
        echo ""
        echo "📋 Login Credentials:"
        echo "   Email: Hostingeraccess7@gmail.com"
        echo "   Password: Admin123!"
    else
        echo ""
        echo "❌ Could not create admin. Please check database connection."
    fi
fi

