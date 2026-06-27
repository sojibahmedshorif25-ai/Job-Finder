/* global process */
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import { getDB } from "../db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "startupforge-jwt-secret-key-123456";

// Password hashing helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Password comparison helper
const comparePassword = async (enteredPassword, hashedPassword) => {
  return await bcrypt.compare(enteredPassword, hashedPassword);
};

// Validation helpers
const validatePassword = (password) => {
  const minLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_]/.test(password);
  return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
};

// Generate JWT token and set cookie helper
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isBlocked: user.isBlocked
      }
    });
};

// Register Route
router.post("/register", async (req, res) => {
  try {
    const { name, email, image, password, role } = req.body;
    const db = getDB();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["Founder", "Collaborator"].includes(role)) {
      return res.status(400).json({ message: "Invalid role selection" });
    }

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Password validation
    if (!validatePassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters with at least one uppercase, one lowercase, one number, and one special character"
      });
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    const newUser = {
      name,
      email,
      image: image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150",
      password: hashedPassword,
      role,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("users").insertOne(newUser);
    const savedUser = { ...newUser, _id: result.insertedId };

    sendTokenResponse(savedUser, 201, res);
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare hashed password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked by the admin" });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// Google Mock/OAuth Auth
router.post("/google", async (req, res) => {
  try {
    const { email, name, image, role } = req.body;
    const db = getDB();

    if (!email || !name) {
      return res.status(400).json({ message: "Email and name are required" });
    }

    let user = await db.collection("users").findOne({ email });

    if (!user) {
      // First time logging in with Google, register them
      const newUser = {
        name,
        email,
        image: image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150",
        password: "GoogleAuthUserPassword123!", // Dummy password for Google users
        role: role || "Collaborator",
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked by the admin" });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ message: "Google authentication failed", error: error.message });
  }
});

// Get Logged In User
router.get("/me", verifyToken, async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.dbUser._id,
      name: req.dbUser.name,
      email: req.dbUser.email,
      image: req.dbUser.image,
      role: req.dbUser.role,
      isBlocked: req.dbUser.isBlocked,
      skills: req.dbUser.skills || [],
      bio: req.dbUser.bio || ""
    }
  });
});

// Logout Route
router.post("/logout", (req, res) => {
  res.cookie("token", "none", {
    httpOnly: true,
    expires: new Date(Date.now() + 1000)
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// Profile update route
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, image, skills, bio } = req.body;
    const db = getDB();

    const updateFields = { updatedAt: new Date() };
    if (name) updateFields.name = name;
    if (image) updateFields.image = image;
    if (skills) {
      updateFields.skills = Array.isArray(skills) 
        ? skills 
        : skills.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (bio !== undefined) updateFields.bio = bio;

    await db.collection("users").updateOne(
      { email: req.dbUser.email },
      { $set: updateFields }
    );

    const updatedUser = await db.collection("users").findOne({ email: req.dbUser.email });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
        role: updatedUser.role,
        skills: updatedUser.skills || [],
        bio: updatedUser.bio || ""
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
});

export default router;
