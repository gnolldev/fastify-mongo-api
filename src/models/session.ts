// src/models/session.ts

import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// Define the schema for the Session collection.
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The refresh token JWT string.
    token: { type: String, required: true, unique: true, index: true },
    // The refresh token's unique identifier (jti).
    rid:   { type: String, required: true, unique: true, index: true },
    // The date when this session document should expire.
    expiresAt: { type: Date, required: true }
  },
  // Add `createdAt` but not `updatedAt` to save a few bytes and an unnecessary update operation.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// --- TTL Index ---
// This special index tells MongoDB to automatically delete documents from this collection
// when the `expiresAt` field's value is reached. This is a highly efficient
// way to auto-prune expired sessions without needing a manual cleanup process.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// --- TypeScript Types ---
// Infer the plain object type from the schema.
export type Session = InferSchemaType<typeof sessionSchema>;
// Infer the hydrated Mongoose document type.
export type SessionDoc = HydratedDocument<Session>;

// --- Mongoose Model ---
// Create and export the Session model.
export const SessionModel = model<Session>("Session", sessionSchema);
