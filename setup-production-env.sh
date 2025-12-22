#!/bin/bash

# Production Environment Setup Script
# This creates the .env files for backend and frontend

DOMAIN="huzaifaiftikhar.engineer"
BACKEND_DIR="~/EHealthMedAI/backend"
FRONTEND_DIR="~/EHealthMedAI/frontend"

cat > /tmp/backend.env << 'ENVEOF'
# ============================================
# EHealth Med AI Platform - Production Environment Variables
# ============================================

# Database Configuration
DATABASE_URL=postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ehealthmedai
DB_USER=ehealthmedai
DB_PASSWORD=str0ng

# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://huzaifaiftikhar.engineer
API_URL=https://huzaifaiftikhar.engineer/api
CORS_ORIGIN=https://huzaifaiftikhar.engineer

# JWT Configuration
JWT_SECRET=6af423629d7effdaca063948cfd056f1ba03b2d5492ff703a89e7af15ec905a0d36038abe616056a033562e255042cd5ad6bab86dee5c513aaa63875ec1e0e98
JWT_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=local-dev-secret-key-change-in-production-123456789
COOKIE_SECURE=true
COOKIE_SAME_SITE=none

# ============================================
# Google OAuth Configuration
# ============================================
GOOGLE_CLIENT_ID=66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://huzaifaiftikhar.engineer/api/auth/google/callback

# ============================================
# AI Service API Keys
# ============================================
OPENAI_API_KEY=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
OPENAI_ORGANIZATION_ID=org-273sNA8dLfgf4K81JY7eobrX
ANTHROPIC_API_KEY=

# ============================================
# ElevenLabs API Configuration
# ============================================
ELEVENLABS_API_KEY=sk_5c5ed30416b3f20cd26583ee0d06cf9c9b53c4dadcc8fd3c
ELEVENLABS_VOICE_ID=PIGsltMj3gFMR34aFDI3
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# ============================================
# Speech-to-Text (STT) Services
# ============================================
GOOGLE_STT_API_KEY=
GOOGLE_STT_PROJECT_ID=
ASSEMBLYAI_API_KEY=5804eeb54d974d4c8ae36ed0a796ef52
DEEPGRAM_API_KEY=91b513294d4c5d5331b27b6a4e1878ae7131bbe7

# ============================================
# Telephony Services
# ============================================
TWILIO_ACCOUNT_SID=ACc5e39fa0b08493ae707aa3a4b9b10218
TWILIO_AUTH_TOKEN=e7aee1828a00aab12771a1f272df7282
TWILIO_PHONE_NUMBER=+17703434007
VONAGE_API_KEY=
VONAGE_API_SECRET=

# ============================================
# Email Service Configuration
# ============================================
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@ehealthmedai.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@ehealthmedai.com

# ============================================
# Encryption & Security
# ============================================
ENCRYPTION_KEY=
ENCRYPTION_ALGORITHM=AES-256

# ============================================
# File Storage (for call recordings, documents)
# ============================================
AWS_ACCESS_KEY_ID=AKIA3FFGM2CDWMNTIFSC
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_S3_BUCKET=ehealth-med-ai-recordings
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ============================================
# Monitoring & Analytics
# ============================================
SENTRY_DSN=
LOG_LEVEL=info
LOG_FORMAT=json

# ============================================
# HIPAA Compliance Services
# ============================================
AUDIT_LOG_SERVICE_URL=
AUDIT_LOG_API_KEY=

# ============================================
# Development/Testing
# ============================================
TEST_MODE=false
MOCK_AI_RESPONSES=false
MOCK_TELEPHONY=false

# ============================================
# Rate Limiting
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# Scheduler Configuration
# ============================================
ENABLE_SCHEDULER=true

# ============================================
# Google Calendar API Configuration
# ============================================
GOOGLE_CALENDAR_CLIENT_ID=407408718192.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_ACCESS_TOKEN=ya29.a0Aa7pCA8F8ZB-YeXdbW-5uI_9XYB1LSDAjaFEzY8pRXbhuVwbVve0CUlCPxFlnTho-_Gfaj6OuX1jCSCV_o1BYjWWfLgc-FNtFzrYUC0oNdENckwsSsdIgJSrUrhMmcMABnV3rctW35mF4xG_WpmqNmc-uhwe7HRBYvrN-uGrOkeBfTWmNTks7wqWm2U1xlJKVIwxTxcaCgYKAX0SARcSFQHGX2Miy_Ae7l3UO6xl78D33822fg0206
GOOGLE_CALENDAR_REFRESH_TOKEN=1//04N8Tb4bAblqwCgYIARAAGAQSNwF-L9IraZYykFTEuUDqAYoL2ISl5XPeczAgN43ufLlmnj3TWUwpA9iFpbhcnzkp4CEqt748fz8
GOOGLE_CALENDAR_ID=primary
ENVEOF

cat > /tmp/frontend.env << 'ENVEOF'
NEXT_PUBLIC_API_URL=https://huzaifaiftikhar.engineer/api
ENVEOF

echo "Environment files created in /tmp/"
echo "Backend .env: /tmp/backend.env"
echo "Frontend .env.local: /tmp/frontend.env"

