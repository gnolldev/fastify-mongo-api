// src/models/user.ts

import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// Define the schema for the User collection.
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,   // Ensure email addresses are unique.
      index: true,    // Index for faster queries.
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,  // Prevent the password hash from being returned in queries by default.
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // --- Verification & Reset Fields ---
    emailVerifiedAt: {
      type: Date,
      default: null, // Null indicates the email has not been verified.
    },
    emailVerificationToken: { // This was missing
      type: String,
      select: false,
    },
    emailVerificationExpires: { // This was missing
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  // Automatically add `createdAt` and `updatedAt` timestamps.
  { timestamps: true }
);

// --- TypeScript Types ---
// Infer the plain object type from the schema.
export type User = InferSchemaType<typeof userSchema>;
// Infer the hydrated Mongoose document type.
export type UserDoc = HydratedDocument<User>;

// --- Mongoose Model ---
// Create and export the User model.
export const UserModel = model<User>("User", userSchema);
