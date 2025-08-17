# Fastify MongoDB API Backend

A production-ready, high-performance, and secure API backend built with **Fastify**, **TypeScript**, and **MongoDB**.  
This project serves as a robust foundation for modern web applications, featuring a complete authentication system with JWT-based sessions, refresh token rotation, and secure email verification.

---

## ✨ Features

- **🔒 Secure by Default:** Implements Helmet for security headers, bcrypt for password hashing, and httpOnly cookies to prevent XSS attacks.  
- **⚡ High Performance:** Built on Fastify, the fastest Node.js web framework. Includes response compression and `.lean()` queries for maximum speed.  
- **🛡️ Brute-Force Protection:** Targeted rate limiting on sign-in and sign-up endpoints.  
- **🔑 Modern Authentication:** JWT-based sessions with refresh token rotation.  
- **✅ Email Verification:** Full email verification flow.  
- **🚀 Production-Ready:** Structured logging, graceful shutdown, and environment variable validation.  

---

## 🛠 Tech Stack

- **Backend:** Fastify, TypeScript, Node.js  
- **Database:** MongoDB with Mongoose  
- **Authentication:** bcrypt, @fastify/jwt  
- **Validation:** Zod  
- **Email:** Nodemailer  

---

## 🚀 Getting Started

### 1. Environment Setup

Create a `.env` file in the root of the project and add your credentials:

```
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:4321

# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=<your-database-name>

# Email (using mailjet for testing)
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-smtp-api-key>
SMTP_PASS=<your-smtp-secret-key>

# Security & Authentication
BCRYPT_COST=12
JWT_SECRET=generate_a_long_random_secret_string_of_at_least_32_chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

# Frontend & CORS
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:4321
```

### 2. Installation

Clone the repository and install dependencies:

```
npm install
```

### 3. Running the Server

Run in development mode with hot reloading:

```
npm run dev
```

Server will be running at: [http://localhost:3001](http://localhost:3001)

---

## 🧪 Testing with cURL

### Sign Up

Create a new user account (verification email will be sent):

```
curl -i -X POST http://localhost:3001/auth/signup   -H "Content-Type: application/json"   -d '{ "email": "user@example.com", "password": "SuperSecret123" }'
```

### Sign In

Login with a verified account. The `-c` flag saves authentication cookies:

```
curl -i -X POST http://localhost:3001/auth/signin   -H "Content-Type: application/json"   -d '{ "email": "user@example.com", "password": "SuperSecret123" }'   -c cookies.txt
```

### Refresh Session

Use saved cookies to get a new access token:

```
curl -i -X POST http://localhost:3001/auth/refresh   -b cookies.txt -c cookies.txt
```

### Sign Out

Invalidate the current session and clear cookies:

```
curl -i -X POST http://localhost:3001/auth/signout   -b cookies.txt -c cookies.txt
```
