#!/bin/bash

# Cleanup script to remove all ngrok references and set to localhost

echo "🧹 Cleaning up ngrok references..."
echo ""

# Update backend .env
if [ -f "backend/.env" ]; then
    echo "📝 Updating backend/.env..."
    
    # Remove ngrok URLs and set to localhost
    sed -i.bak 's|API_URL=.*|API_URL=http://localhost:5000/api|' backend/.env 2>/dev/null || sed -i '' 's|API_URL=.*|API_URL=http://localhost:5000/api|' backend/.env
    sed -i.bak 's|FRONTEND_URL=.*|FRONTEND_URL=http://localhost:3000|' backend/.env 2>/dev/null || sed -i '' 's|FRONTEND_URL=.*|FRONTEND_URL=http://localhost:3000|' backend/.env
    sed -i.bak 's|CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:3000|' backend/.env 2>/dev/null || sed -i '' 's|CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:3000|' backend/.env
    sed -i.bak 's|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback|' backend/.env 2>/dev/null || sed -i '' 's|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback|' backend/.env
    
    rm -f backend/.env.bak
    echo "✅ Backend .env updated to localhost"
else
    echo "⚠️  backend/.env not found"
fi

# Update frontend .env.local
if [ -f "frontend/.env.local" ]; then
    echo "📝 Updating frontend/.env.local..."
    
    sed -i.bak 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:5000/api|' frontend/.env.local 2>/dev/null || sed -i '' 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:5000/api|' frontend/.env.local
    
    rm -f frontend/.env.local.bak
    echo "✅ Frontend .env.local updated to localhost"
else
    echo "📝 Creating frontend/.env.local..."
    echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > frontend/.env.local
    echo "✅ Frontend .env.local created"
fi

echo ""
echo "✅ Cleanup complete! All URLs set to localhost"
echo ""
echo "📝 Updated:"
echo "   - backend/.env → localhost:5000"
echo "   - frontend/.env.local → localhost:5000/api"
echo ""
echo "🔄 Restart your services:"
echo "   - Backend: cd backend && npm start"
echo "   - Frontend: cd frontend && npm start"
echo ""

