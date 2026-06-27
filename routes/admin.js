import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply admin role verification to all routes below
router.use(verifyToken, requireRole(["Admin"]));

// Get Admin Overview Stats
router.get("/overview", async (req, res) => {
  try {
    const db = getDB();

    const totalUsers = await db.collection("users").countDocuments();
    const totalStartups = await db.collection("startups").countDocuments();
    const totalOpportunities = await db.collection("opportunities").countDocuments();

    // Calculate total revenue
    const payments = await db.collection("payments").find({ payment_status: "succeeded" }).toArray();
    const totalRevenue = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalStartups,
        totalOpportunities,
        totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admin statistics", error: error.message });
  }
});

// View All Users
router.get("/users", async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection("users")
      .find({}, { projection: { password: 0 } }) // Exclude passwords
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

// Block User
router.put("/users/:id/block", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const userToBlock = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!userToBlock) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userToBlock.role === "Admin") {
      return res.status(400).json({ message: "You cannot block an Admin account" });
    }

    await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isBlocked: true, updatedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: "User has been blocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to block user", error: error.message });
  }
});

// Unblock User
router.put("/users/:id/unblock", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isBlocked: false, updatedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: "User has been unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to unblock user", error: error.message });
  }
});

// View All Startups (Pending + Approved + Removed)
router.get("/startups", async (req, res) => {
  try {
    const db = getDB();
    const startups = await db.collection("startups")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich each startup with founder name from users collection
    const enrichedStartups = await Promise.all(
      startups.map(async (s) => {
        const founder = await db.collection("users").findOne(
          { email: s.founder_email },
          { projection: { name: 1 } }
        );
        return {
          ...s,
          founder_name: founder ? founder.name : "Platform Member"
        };
      })
    );

    res.status(200).json({ success: true, startups: enrichedStartups });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch startups", error: error.message });
  }
});

// Approve Startup
router.put("/startups/:id/approve", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    await db.collection("startups").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Approved" } }
    );

    res.status(200).json({ success: true, message: "Startup approved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to approve startup", error: error.message });
  }
});

// Remove Startup
router.put("/startups/:id/remove", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    await db.collection("startups").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Removed" } }
    );

    res.status(200).json({ success: true, message: "Startup removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove startup", error: error.message });
  }
});

// View Transactions
router.get("/transactions", async (req, res) => {
  try {
    const db = getDB();
    const transactions = await db.collection("payments")
      .find()
      .sort({ paid_at: -1 })
      .toArray();

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions", error: error.message });
  }
});

export default router;
