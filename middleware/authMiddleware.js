import jwt from "jsonwebtoken";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { auth } from "../auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "startupforge-jwt-secret-key-123456";

async function findOrCreateUser(email, name, image, role) {
  const db = getDB();
  let user = await db.collection("users").findOne({ email });
  if (!user) {
    const newUser = {
      name: name || email.split("@")[0],
      email,
      image: image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150",
      role: role || "Collaborator",
      isBlocked: false,
      skills: [],
      bio: "",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("users").insertOne(newUser);
    user = { ...newUser, _id: result.insertedId };
  }
  return user;
}

export async function verifyToken(req, res, next) {
  // 1. Try JWT token (existing custom auth)
  const token = req.cookies?.token;
  if (token) {
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      req.user = verified;
      const db = getDB();
      const dbUser = await db.collection("users").findOne({ email: req.user.email });
      if (!dbUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (dbUser.isBlocked) {
        return res.status(403).json({ message: "Your account has been blocked by the admin" });
      }
      req.dbUser = dbUser;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  }

  // 2. Try Better Auth session
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session && session.user) {
      const baUser = session.user;
      const dbUser = await findOrCreateUser(baUser.email, baUser.name, baUser.image, baUser.role);
      if (dbUser.isBlocked) {
        return res.status(403).json({ message: "Your account has been blocked by the admin" });
      }
      req.user = { id: dbUser._id, email: dbUser.email, role: dbUser.role };
      req.dbUser = dbUser;
      return next();
    }
  } catch (baError) {
    // Better Auth session check failed, fall through to 401
  }

  return res.status(401).json({ message: "Access Denied: No valid token or session" });
}

// Middleware to authorize specific roles
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.dbUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ message: "Forbidden: You do not have permission" });
    }

    next();
  };
}
