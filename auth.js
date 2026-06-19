import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "./db.js";

// Initialize Better Auth with MongoDB adapter and custom fields
export const auth = betterAuth({
  database: mongodbAdapter(client.db()),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret"
    }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "Collaborator", // Founder, Collaborator, Admin
        input: true
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      }
    }
  }
});
