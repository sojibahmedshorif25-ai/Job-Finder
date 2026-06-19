import jwt from "jsonwebtoken";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "startupforge-jwt-secret-key-123456";

export async function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided" });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;

    // Check if user is blocked in database
    const db = getDB();
    const user = await db.collection("users").findOne({ email: req.user.email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked by the admin" });
    }

    // Attach full database user details to request
    req.dbUser = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
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
