# EHealth Med AI - Backend

Backend API server for the EHealth Med AI platform, built with Node.js, Express.js, and PostgreSQL.

## Features

- 🔐 JWT-based authentication
- 🤖 AI Agent management
- 🎙️ Voice AI configuration (STT, NLU, TTS)
- 📊 Analytics and reporting
- 🔒 Security features (access policies, encryption keys)
- 📋 Requirements management
- 🔗 EHR integrations (FHIR, HL7)
- 📞 Telephony integration
- 🎯 HIPAA compliance features

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **AI Services**: OpenAI, ElevenLabs

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/ehealth_med_ai
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ehealth_med_ai
DB_USER=your_username
DB_PASSWORD=your_password

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:5000/api

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your-openai-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Mock AI Responses (for testing without API keys)
MOCK_AI_RESPONSES=false
```

3. Set up the database:
```bash
# Create database
createdb ehealth_med_ai

# Or using psql:
psql -U postgres
CREATE DATABASE ehealth_med_ai;
```

4. Run database migrations:
```bash
# Run all migrations
node scripts/migrate.js

# Or run specific milestone migrations
node scripts/migrate-m2-simple.js
node scripts/migrate-m3-simple.js
```

5. Create default admin user:
```bash
node scripts/create-admin.js
```

6. Create default agents:
```bash
node scripts/create-default-agents.js
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will run on `http://localhost:5000` (or the port specified in `.env`)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/verify` - Verify token

### Agents
- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get agent by ID
- `POST /api/agents` - Create new agent
- `PUT /api/agents/:id` - Update agent
- `POST /api/agents/:id/test` - Test agent response

### Voice AI
- `GET /api/voice-ai/stt/:agentId` - Get STT configuration
- `POST /api/voice-ai/stt` - Save STT configuration
- `GET /api/voice-ai/nlu/:agentId` - Get NLU configuration
- `POST /api/voice-ai/nlu` - Save NLU configuration
- `GET /api/voice-ai/tts/:agentId` - Get TTS configuration
- `POST /api/voice-ai/tts` - Save TTS configuration
- `POST /api/voice-ai/tts/test` - Test TTS
- `GET /api/voice-ai/tts/elevenlabs/voices` - Get ElevenLabs voices

### Requirements
- `GET /api/requirements` - Get all requirements
- `POST /api/requirements` - Create requirement
- `GET /api/requirements/:id` - Get requirement by ID

### And many more...

## Project Structure

```
backend/
├── config/
│   ├── database.js          # Database connection
│   └── *.sql                # Database schemas
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── agents.js            # Agent management
│   ├── voice-ai.js          # Voice AI configuration
│   └── ...                  # Other route files
├── services/
│   ├── aiService.js         # AI service integration
│   └── ttsService.js        # TTS service integration
├── scripts/
│   ├── migrate.js           # Database migrations
│   ├── create-admin.js      # Create admin user
│   └── ...                  # Utility scripts
├── .env                     # Environment variables (not in git)
├── server.js                # Main server file
└── package.json
```

## Environment Variables

See `.env.example` (if available) or the Installation section above for required environment variables.

## Security Notes

- **Never commit `.env` files** - They contain sensitive information
- Change `JWT_SECRET` in production
- Use strong database passwords
- Enable SSL for database connections in production
- Implement rate limiting for production
- Use HTTPS in production

## Testing

For testing without API keys, set `MOCK_AI_RESPONSES=true` in your `.env` file.

## License

MIT

