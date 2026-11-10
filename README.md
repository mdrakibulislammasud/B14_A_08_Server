# Neighbourly – Backend Server

Neighbourly is a community-driven social development events platform. This repository contains the backend server responsible for authentication, database connectivity, and API services for the application.

## Features

- **Authentication:** Secure authentication using Better Auth.
- **Google Login:** Support for Google OAuth authentication.
- **Email and Password Login:** User registration and login.
- **Session Management:** Manage authenticated user sessions.
- **MongoDB Integration:** Connect and interact with MongoDB.
- **CORS Configuration:** Allow requests from the authorized client application.
- **Environment Configuration:** Keep sensitive credentials and configuration in environment variables.

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Better Auth
- CORS
- dotenv

## Live API

**Server URL:** https://neighbourly-server-black.vercel.app

**API Health Check:**

https://neighbourly-server-black.vercel.app/

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/mdrakibulislammasud/B14_A_08_Server.git
```

### 2. Navigate to the project directory

```bash
cd B14_A_08_Server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name

BETTER_AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_URL=http://localhost:5000

CLIENT_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Replace the placeholder values with your own credentials. Never commit your `.env` file or expose secret keys publicly.

### 5. Run the server

```bash
npm start
```

If no start script is configured, use the project's configured entry point:

```bash
node index.js
```

## Authentication

The backend uses Better Auth for authentication.

Supported authentication methods:

- Email and password authentication.
- Google OAuth authentication.
- Session-based authentication.

Authentication endpoints are handled under:

```text
/api/auth/*
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Server port |
| `NODE_ENV` | Application environment |
| `MONGODB_URI` | MongoDB connection string |
| `DB_NAME` | MongoDB database name |
| `BETTER_AUTH_SECRET` | Better Auth secret |
| `BETTER_AUTH_URL` | Backend base URL |
| `CLIENT_URL` | Authorized frontend origin |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## Deployment

The backend is deployed using Vercel.

**Production Server:** https://neighbourly-server-black.vercel.app

## Project Links

- **Live Client:** https://neighbourly-client.vercel.app
- **Server Repository:** https://github.com/mdrakibulislammasud/B14_A_08_Server
- **Client Repository:** https://github.com/mdrakibulislammasud/B14_A_08_Client

## Purpose

The backend provides the authentication, database connectivity, and server-side services required to support the Neighbourly community events platform.