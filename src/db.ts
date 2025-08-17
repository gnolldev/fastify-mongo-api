// src/db.ts

import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Establishes and configures the MongoDB database connection.
 */
export async function connectDb() {
  // Enforce strict query validation.
  mongoose.set("strictQuery", true);

  // Disable automatic index creation in production for better performance.
  mongoose.set("autoIndex", process.env.NODE_ENV !== "production");

  // Connect to the database using credentials from environment variables.
  await mongoose.connect(env.MONGO_URI, { dbName: env.MONGO_DB_NAME });

  // Return the connection object for use in the server setup (e.g., for graceful shutdown).
  return mongoose.connection;
}
