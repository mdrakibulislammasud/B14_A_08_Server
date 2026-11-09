
import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";

import { client } from "./db.mjs";

// Validate environment variables
const AUTH_URL = process.env.BETTER_AUTH_URL;
const AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const DB_NAME = process.env.DB_NAME;

if (!AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is missing in .env");
}

if (!AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is missing in .env");
}

if (!DB_NAME) {
  throw new Error("DB_NAME is missing in .env");
}

// Configure trusted origins
const trustedOrigins = (
  process.env.CLIENT_URL || ""
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Initialize Better Auth
export const auth = betterAuth({
  appName: "Neighbourly",

  baseURL: AUTH_URL,

  secret: AUTH_SECRET,

  trustedOrigins,

  database: mongodbAdapter(
    client.db(DB_NAME),
    { client }
  ),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },

  plugins: [
    jwt()
  ]
});
