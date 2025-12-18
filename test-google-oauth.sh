#!/bin/bash

echo "🔍 Testing Google OAuth Configuration..."
echo ""

# Check backend .env
echo "1. Checking backend .env..."
if [ -f backend/.env ]; then
  echo "   ✅ backend/.env exists"
  echo "   GOOGLE_CLIENT_ID: $(grep GOOGLE_CLIENT_ID backend/.env | cut -d'=' -f2 | head -c 30)..."
  echo "   GOOGLE_REDIRECT_URI: $(grep GOOGLE_REDIRECT_URI backend/.env | cut -d'=' -f2)"
  echo "   FRONTEND_URL: $(grep FRONTEND_URL backend/.env | cut -d'=' -f2)"
else
  echo "   ❌ backend/.env NOT FOUND"
fi

echo ""
echo "2. Testing backend endpoint..."
BACKEND_RESPONSE=$(curl -s http://localhost:5000/api/auth/google 2>&1)
if echo "$BACKEND_RESPONSE" | grep -q "localhost:5000"; then
  echo "   ✅ Backend returns localhost redirect URI"
else
  echo "   ⚠️  Backend response:"
  echo "$BACKEND_RESPONSE" | head -5
fi

echo ""
echo "3. Checking frontend .env.local..."
if [ -f frontend/.env.local ]; then
  echo "   ✅ frontend/.env.local exists"
  echo "   NEXT_PUBLIC_API_URL: $(grep NEXT_PUBLIC_API_URL frontend/.env.local | cut -d'=' -f2)"
else
  echo "   ❌ frontend/.env.local NOT FOUND"
fi

echo ""
echo "4. Checking callback page..."
if [ -f frontend/app/auth/callback/page.tsx ]; then
  echo "   ✅ Callback page exists"
  if grep -q "tokenManager.setToken" frontend/app/auth/callback/page.tsx; then
    echo "   ✅ Callback page has token storage logic"
  else
    echo "   ❌ Callback page missing token storage"
  fi
else
  echo "   ❌ Callback page NOT FOUND"
fi

echo ""
echo "✅ Test complete!"
