#!/bin/bash
# Check Admin User and Reset Password if Needed

echo "🔍 Checking admin users..."
echo ""

# Query database for admin users
psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai <<EOF
SELECT id, email, first_name, last_name, role, is_active, 
       CASE WHEN password_hash IS NULL THEN 'No Password' ELSE 'Has Password' END as password_status,
       created_at 
FROM users 
WHERE role = 'admin' 
ORDER BY id;
EOF

echo ""
echo "📝 To reset password for an admin user, run:"
echo "   node backend/scripts/reset-password.js <email> <newPassword>"
echo ""
echo "💡 Example:"
echo "   node backend/scripts/reset-password.js Hostingeraccess7@gmail.com Admin123!"

