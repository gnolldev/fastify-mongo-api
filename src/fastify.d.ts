// src/fastify.d.ts

// This declaration file extends the default types for Fastify and its plugins.
// It informs TypeScript about custom decorators and JWT payload structures,
// enabling type safety and autocompletion without containing any runtime code.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JWT } from '@fastify/jwt';

// Define the shape of the access token payload.
interface AccessTokenPayload {
  sub: string;
  role: 'user' | 'admin';
  email: string;
}

// Define the shape of the refresh token payload.
interface RefreshTokenPayload {
  sub: string;
  rid: string;
}

// Augment the types for the @fastify/jwt plugin.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    // The raw payload can be for either an access or refresh token.
    payload: AccessTokenPayload | RefreshTokenPayload;
    
    // `request.user` will always be the verified access token payload.
    user: AccessTokenPayload & { iat: number; exp: number; };
  }
}

// Augment the core Fastify types.
declare module 'fastify' {
  export interface FastifyInstance {
    // Add the .authenticate decorator to the Fastify instance type.
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
