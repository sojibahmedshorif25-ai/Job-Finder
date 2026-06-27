import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { auth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import startupRoutes from "./routes/startups.js";
import opportunityRoutes from "./routes/opportunities.js";
import applicationRoutes from "./routes/applications.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup to allow client-side requests with credentials (cookies)
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://job-finder-client.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || origin.endsWith(".railway.app")) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

const isProduction = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(cookieParser());

// Base Route
app.get("/", (req, res) => {
  res.send("StartupForge API is running...");
});

// Better Auth Express routes using api methods directly
app.post("/api/auth-better/sign-in", async (req, res, next) => {
  try {
    const data = await auth.api.signInEmail({ body: req.body, headers: req.headers, asResponse: false });
    if (data?.token) {
      // Set cookie manually from the response data
      res.cookie("better-auth.session_token", data.token, {
        httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
    res.json(data);
  } catch (err) { next(err); }
});
app.post("/api/auth-better/sign-up", async (req, res, next) => {
  try {
    const data = await auth.api.signUpEmail({ body: req.body, headers: req.headers, asResponse: false });
    if (data?.token) {
      res.cookie("better-auth.session_token", data.token, {
        httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
    res.json(data);
  } catch (err) { next(err); }
});
app.get("/api/auth-better/session", async (req, res, next) => {
  try {
    const data = await auth.api.getSession({ headers: req.headers });
    res.json(data);
  } catch (err) { next(err); }
});
app.post("/api/auth-better/sign-out", async (req, res, next) => {
  try {
    const data = await auth.api.signOut({ headers: req.headers, asResponse: false });
    res.json(data);
  } catch (err) { next(err); }
});
app.get("/api/auth-better/social-sign-in", async (req, res, next) => {
  try {
    const serverUrl = process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`;
    const data = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: `${serverUrl}/api/auth/callback/google` },
      headers: req.headers,
      asResponse: false
    });
    res.json(data);
  } catch (err) { next(err); }
});

// Better Auth callback handler for OAuth redirects (Google, etc.)
app.all("/api/auth/callback/:provider", async (req, res, next) => {
  try {
    const serverUrl = process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`;
    const url = new URL(req.url, serverUrl);
    const data = await auth.api.callbackOAuth({ query: Object.fromEntries(url.searchParams), headers: req.headers, asResponse: false });
    if (data?.token) {
      res.cookie("better-auth.session_token", data.token, {
        httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
    // Redirect to client app after successful Google OAuth
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/dashboard`);
  } catch (err) { next(err); }
});

// Seed route
app.get("/api/seed", async (req, res) => {
  try {
    const { seed } = await import("./seed.js");
    await seed();
    res.send("Database seeded successfully!");
  } catch (err) {
    console.error("Seeding error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/startups", startupRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    message: "Something went wrong on the server",
    ...(isProduction ? {} : { error: err.message })
  });
});

// Connect to Database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server due to DB connection failure", err);
});
