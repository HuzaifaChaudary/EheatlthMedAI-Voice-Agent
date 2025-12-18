# EHealth Med AI Platform

A HIPAA-compliant AI Voice Agents platform for healthcare, built with Next.js and Express.js.

## Features

- 🏥 **HIPAA-Compliant** - Secure and compliant healthcare platform
- 🤖 **AI Voice Agents** - Multiple specialized agents:
  - Front Desk Assistant
  - Medical Assistant
  - Triage Nurse
  - Billing Specialist
  - Collections Specialist
- 🔐 **Authentication** - Secure user authentication with JWT
- 📊 **PostgreSQL Database** - Robust data storage
- 🎨 **Modern UI** - Beautiful, responsive design

## Tech Stack

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- bcryptjs for password hashing

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd EHealthMedAI
```

### 2. Set up Backend

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Edit `backend/.env` and update the database URL:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/ehealth_med_ai
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

### 4. Set up Database

Create a PostgreSQL database:

```bash
createdb ehealth_med_ai
```

Or using psql:

```sql
CREATE DATABASE ehealth_med_ai;
```

Run migrations:

```bash
npm run migrate
```

### 5. Set up Frontend

```bash
cd ../frontend
npm install
```

The frontend `.env.local` is already configured with the default API URL.

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:5000`

### Start Frontend Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token

### AI Agents
- `GET /api/agents` - Get all agents (requires auth)
- `GET /api/agents/:id` - Get agent by ID (requires auth)
- `POST /api/agents` - Create new agent (requires auth)
- `PUT /api/agents/:id` - Update agent (requires auth)

### Users
- `GET /api/users/me` - Get current user profile (requires auth)
- `GET /api/users` - Get all users (admin only)

## Project Structure

```
EHealthMedAI/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   └── db.sql
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── agents.js
│   │   └── users.js
│   ├── scripts/
│   │   └── migrate.js
│   ├── .env
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── .env.local
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

## AWS Deployment

For deploying to AWS (EC2 + RDS), see the comprehensive deployment guide:

📖 **[AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md)**

The guide covers:
- Setting up AWS RDS PostgreSQL database
- Deploying backend on EC2
- Deploying frontend on EC2
- Nginx configuration
- SSL setup with Let's Encrypt
- Security best practices

**Deployment Order:**
1. AWS RDS (PostgreSQL) - Set up database first
2. Backend EC2 - Deploy backend and connect to RDS
3. Frontend EC2 - Deploy frontend and connect to backend

## Security Notes

- Change the `JWT_SECRET` in production
- Use strong passwords for database
- Enable SSL for database connections in production
- Implement rate limiting for production
- Add input validation and sanitization
- Use HTTPS in production

## License

MIT

# EheatlthMedAI-Voice-Agent
