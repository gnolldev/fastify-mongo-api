// src/routes/auth-routes.ts

// --- Core Dependencies ---
import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import ms, { StringValue } from "ms";

// --- Application Modules ---
import { UserModel } from "../models/user.js";
import { SessionModel } from "../models/session.js";
import { env } from "../env.js";
import { RefreshTokenPayload } from "../fastify.d.js";
import { sendEmail } from "../email.js";

// --- TTL Constants ---
// Pre-calculate token expiration times to avoid recalculations in handlers.
const REFRESH_TTL_MS = ms(env.REFRESH_TOKEN_TTL as StringValue);
if (typeof REFRESH_TTL_MS !== "number") {
  throw new Error(`Invalid REFRESH_TOKEN_TTL: ${env.REFRESH_TOKEN_TTL}`);
}
const REFRESH_TTL_S = Math.floor(REFRESH_TTL_MS / 1000);

const ACCESS_TTL_MS = ms(env.ACCESS_TOKEN_TTL as StringValue);
if (typeof ACCESS_TTL_MS !== "number") {
  throw new Error(`Invalid ACCESS_TOKEN_TTL: ${env.ACCESS_TOKEN_TTL}`);
}
const ACCESS_TTL_S = Math.floor(ACCESS_TTL_MS / 1000);

const VERIFICATION_TTL_MS = ms(env.EMAIL_VERIFICATION_TOKEN_TTL as StringValue);
if (typeof VERIFICATION_TTL_MS !== "number") {
  throw new Error(`Invalid EMAIL_VERIFICATION_TOKEN_TTL: ${env.EMAIL_VERIFICATION_TOKEN_TTL}`);
}

// --- Zod Validation Schema ---
// Define a reusable schema for user authentication input.
const authBodySchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

// Infer a TypeScript type from the schema for type safety.
type AuthBody = z.infer<typeof authBodySchema>;

// New schema for validating the incoming email verification code.
const verifyEmailSchema = z.object({
  email: z.string().email("A valid email is required"),
  code: z.string().length(6, "Verification code must be 6 digits"),
});
type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;


// --- Type Guard ---
// A custom type guard to safely identify refresh token payloads.
function isRefreshTokenPayload(payload: any): payload is RefreshTokenPayload {
    return typeof payload === 'object' && payload !== null && 'rid' in payload && 'sub' in payload;
}

/**
 * Registers all authentication-related routes.
 * @param {FastifyInstance} app - The Fastify instance.
 */
export default async function authRoutes(app: FastifyInstance) {

  // --- User Signup ---
  app.post<{ Body: AuthBody }>(
    "/signup",
    {
      // Validate request body.
      schema: {
        body: authBodySchema
      },
      // Add stricter rate limit config.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);

      try {
        // --- Email Verification Code Generation ---
        // Create a random, 6-digit code for the user to verify their email.
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Hash the code before saving it to the database for security.
        const hashedCode = crypto
          .createHash("sha256")
          .update(verificationCode)
          .digest("hex");

        // Set an expiration date for the token.
        const tokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);

        await UserModel.create({
          email,
          passwordHash,
          role: "user",
          emailVerifiedAt: null,
          emailVerificationToken: hashedCode,
          emailVerificationExpires: tokenExpires,
        });

        // --- Send Verification Email ---
        // Log the code in development for easy testing.
        app.log.info(`Verification code for ${email}: ${verificationCode}`);

        // Send the verification email to the user's address.
        await sendEmail({
          to: email,
          subject: "Your Verification Code",
          html: `<p>Your verification code is: <strong>${verificationCode}</strong></p><p>This code will expire in ${env.EMAIL_VERIFICATION_TOKEN_TTL}.</p>`,
        });

        return reply
          .code(201)
          .send({ message: "Verification code sent. Please check your inbox." });
      } catch (err: any) {
        // Handle duplicate email error.
        if (err?.code === 11000) {
          return reply.code(409).send({ error: "Email already registered" });
        }
        app.log.error(err);
        return reply.code(500).send({ error: "Internal error" });
      }
    }
  );

  // --- Verify Email (NEW) ---
  // This new route handles the code sent from the frontend after the user receives the email.
  app.post<{ Body: VerifyEmailBody }>(
    "/verify-email",
    { schema: { body: verifyEmailSchema } },
    async (request, reply) => {
      const { email, code } = request.body;
      // Hash the incoming code to match the one stored in the database.
      const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

      // Find user by email, ensuring the verification code matches and has not expired.
      const user = await UserModel.findOne({
        email,
        emailVerificationToken: hashedCode,
        emailVerificationExpires: { $gt: new Date() },
      });

      if (!user) {
        return reply.code(400).send({ error: "Invalid or expired verification code." });
      }

      // Mark user as verified and clear verification fields for security.
      user.emailVerifiedAt = new Date();
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      // --- Automatically sign the user in ---
      // After successful verification, create a session for the user.
      const accessToken = app.jwt.sign({ sub: String(user._id), role: user.role, email: user.email }, { expiresIn: env.ACCESS_TOKEN_TTL });
      const rid = crypto.randomUUID();
      const refreshToken = app.jwt.sign({ sub: String(user._id), rid }, { expiresIn: env.REFRESH_TOKEN_TTL });

      await SessionModel.create({
        userId: user._id,
        token: refreshToken,
        rid,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      });

      // Set the authentication cookies in the browser.
      reply.setCookie("refresh_token", refreshToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: REFRESH_TTL_S });
      reply.setCookie("access_token", accessToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: ACCESS_TTL_S });

      return reply.send({ message: "Email verified successfully. You are now logged in." });
    }
  );
  
  // --- User Signin ---
  app.post<{ Body: AuthBody }>(
    "/signin",
    {
      // Validate request body.
      schema: {
        body: authBodySchema
      },
      // Add stricter rate limit config.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // Find user and include password hash for comparison.
      const user = await UserModel.findOne({ email }).select("+passwordHash").lean();
      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      // Block login if email is not verified.
      if (!user.emailVerifiedAt) {
        return reply.code(403).send({ error: "Email not verified" });
      }

      // Securely compare password with stored hash.
      const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash!);
      if (!isPasswordCorrect) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      // --- Token Generation ---
      const accessToken = app.jwt.sign({ sub: String(user._id), role: user.role, email: user.email }, { expiresIn: env.ACCESS_TOKEN_TTL });
      const rid = crypto.randomUUID();
      const refreshToken = app.jwt.sign({ sub: String(user._id), rid }, { expiresIn: env.REFRESH_TOKEN_TTL });

      // Persist the refresh token session in the database.
      await SessionModel.create({
        userId: user._id,
        token: refreshToken,
        rid,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      });

      // --- Set Secure Cookies ---
      reply.setCookie("refresh_token", refreshToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: REFRESH_TTL_S });
      reply.setCookie("access_token", accessToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: ACCESS_TTL_S });

      // Return non-sensitive user data.
      return reply.send({
        user: { id: user._id, email: user.email, role: user.role, createdAt: user.createdAt },
      });
    }
  );

  // --- Token Refresh ---
  app.post("/refresh", async (request, reply) => {
    const { refresh_token: refreshToken } = request.cookies;
    if (!refreshToken) {
      return reply.code(401).send({ error: "No refresh token" });
    }

    try {
      const payload = app.jwt.verify(refreshToken);
      // Use the type guard to safely identify the payload.
      if (!isRefreshTokenPayload(payload)) {
        return reply.code(401).send({ error: "Invalid token type for refresh." });
      }

      // Check for a valid, unexpired session in the database.
      const session = await SessionModel.findOne({ token: refreshToken, rid: payload.rid }).lean();
      if (!session || session.expiresAt < new Date()) {
        reply.clearCookie("refresh_token");
        return reply.code(401).send({ error: "Invalid or expired refresh token" });
      }
      
      // Ensure the user associated with the token still exists.
      const user = await UserModel.findById(payload.sub).lean();
      if (!user) {
        await SessionModel.deleteOne({ _id: session._id }); // Clean up orphaned session.
        reply.clearCookie("refresh_token");
        return reply.code(401).send({ error: "Invalid user for session" });
      }

      // --- Refresh Token Rotation ---
      await SessionModel.deleteOne({ _id: session._id }); // Invalidate old session.

      const newRid = crypto.randomUUID();
      const newRefreshToken = app.jwt.sign({ sub: payload.sub, rid: newRid }, { expiresIn: env.REFRESH_TOKEN_TTL });
      await SessionModel.create({
        userId: payload.sub, token: newRefreshToken, rid: newRid, expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      });

      // Issue a new access token.
      const accessToken = app.jwt.sign({ sub: String(user._id), role: user.role, email: user.email }, { expiresIn: env.ACCESS_TOKEN_TTL });
      
      // Set the new tokens in cookies.
      reply.setCookie("refresh_token", newRefreshToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: REFRESH_TTL_S });
      reply.setCookie("access_token", accessToken, { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, maxAge: ACCESS_TTL_S });

      return reply.send({ accessToken });
    } catch (err) {
      app.log.error(err);
      return reply.code(401).send({ error: "Invalid refresh token" });
    }
  });

  // --- User Signout ---
  app.post("/signout", async (request, reply) => {
    const { refresh_token: refreshToken } = request.cookies;
    if (refreshToken) {
      await SessionModel.deleteOne({ token: refreshToken });
    }

    // Clear authentication cookies from the browser.
    reply.clearCookie("refresh_token", { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE });
    reply.clearCookie("access_token", { path: "/", httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE });

    return reply.send({ success: true });
  });

  // --- Get Current User ---
  // Protected route to fetch the authenticated user's info.
  app.get("/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    return { user: request.user };
  });
}
