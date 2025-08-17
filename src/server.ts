// src/server.ts

// --- Core Dependencies ---
import fastify, { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";

// --- Fastify Plugins ---
import compress from '@fastify/compress';
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

// --- Application Modules ---
import { connectDb } from "./db.js";
import authRoutes from "./routes/auth-routes.js";
import { env } from "./env.js";


async function start() {
  const app = fastify({
    logger:
      process.env.NODE_ENV !== "production"
        ? { // --- DEVELOPMENT LOGGER ---
            // Use pino-pretty for human-readable logs in your terminal.
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            },
          }
        : { // --- PRODUCTION LOGGER ---
            // Use pino-mongodb to write structured JSON logs to your database.
            transport: {
              target: 'pino-mongodb',
              options: {
                uri: env.MONGO_URI,
                database: env.MONGO_DB_NAME,
                collection: 'logs' // This will be the name of the collection
              }
            }
          },
  });

  // Set Zod as the schema validator and serializer.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Establish the database connection on startup.
  const connection = await connectDb();

  // --- Register Core Plugins ---
  await app.register(compress);      // Compress response payloads.
  await app.register(helmet);        // Set important security headers.
  await app.register(cors, {         // Configure CORS for the frontend.
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // --- Register Auth Plugins ---
  await app.register(fastifyCookie); // Parse request cookies.
  await app.register(fastifyJwt, {   // Manage JSON Web Tokens.
    secret: env.JWT_SECRET,
    sign: { algorithm: "HS256", expiresIn: env.ACCESS_TOKEN_TTL },
    cookie: { cookieName: "access_token", signed: false },
  });
  
  // Protect against brute-force attacks.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // --- Application Logic ---
  // Add a reusable authentication decorator for protected routes.
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // Add a health check endpoint for monitoring.
  app.get("/health", async () => {
    const ready = mongoose.connection.readyState;
    try {
      await mongoose.connection.db?.admin().ping();
      return { ok: true, mongo: ready };
    } catch {
      return { ok: false, mongo: ready };
    }
  });

  // Register API routes.
  await app.register(authRoutes, { prefix: "/auth" });

  // --- Hooks & Error Handling ---
  // Ensure the database connection is closed on shutdown.
  app.addHook("onClose", async () => {
    await connection.close();
  });

  // Centralized error handler to format errors consistently.
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const code = typeof (err as any).statusCode === "number" ? (err as any).statusCode : 500;
    reply.code(code).send({ error: err.message ?? "Internal error" });
  });

  // --- Start Server ---
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

start();
