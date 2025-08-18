// src/env.ts

// Load environment variables from a .env file into process.env.
import "dotenv/config";
// Import Zod for schema-based validation.
import { z } from "zod";

// Define a schema for all environment variables.
const Env = z.object({
  // Server config
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.url(),

  // Database config
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_DB_NAME: z.string().min(1, "MONGO_DB_NAME is required"),

  // --- Email config ---
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.string().transform((v) => v.toLowerCase() === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1, "SMTP_FROM is required"),

  // Security & auth config
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  EMAIL_VERIFICATION_TOKEN_TTL: z.string().default("10m"),
  
  // Frontend & CORS config
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"), // Convert string to boolean
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
});

// Parse and validate process.env against the schema.
// This will throw an error on startup if the configuration is invalid.
export const env = Env.parse(process.env);
