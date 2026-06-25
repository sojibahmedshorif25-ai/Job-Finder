import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create Startup (Founder only)
router.post("/", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { startup_name, logo, industry, description, funding_stage, team_size } = req.body;
    const db = getDB();

    if (!startup_name || !logo || !industry || !description || !funding_stage || !team_size) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingStartup = await db.collection("startups").findOne({ founder_email: req.dbUser.email });
    if (existingStartup) {
      return res.status(400).json({ message: "You have already created a startup profile. You can only manage one startup." });
    }

    const newStartup = {
      startup_name,
      logo,
      industry,
      description,
      funding_stage,
      team_size: Number(team_size),
      founder_email: req.dbUser.email,
      status: "Pending", // Default status, pending Admin approval
      createdAt: new Date()
    };

    const result = await db.collection("startups").insertOne(newStartup);
    
    res.status(201).json({
      success: true,
      message: "Startup profile created successfully and pending admin approval",
      startup: { ...newStartup, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create startup profile", error: error.message });
  }
});

// Get Founder's Startup Profile (Founder only)
router.get("/my-startup", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    const startup = await db.collection("startups").findOne({ founder_email: req.dbUser.email });
    
    if (!startup) {
      return res.status(404).json({ message: "Startup profile not found" });
    }

    res.status(200).json({ success: true, startup });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch startup profile", error: error.message });
  }
});

// Update Startup (Founder only)
router.put("/:id", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { startup_name, logo, industry, description, funding_stage, team_size } = req.body;
    const db = getDB();
    const id = req.params.id;

    const startup = await db.collection("startups").findOne({ _id: new ObjectId(id) });
    if (!startup) {
      return res.status(404).json({ message: "Startup not found" });
    }

    if (startup.founder_email !== req.dbUser.email) {
      return res.status(403).json({ message: "Access Denied: You are not the owner of this startup" });
    }

    const updateFields = {};
    if (startup_name) updateFields.startup_name = startup_name;
    if (logo) updateFields.logo = logo;
    if (industry) updateFields.industry = industry;
    if (description) updateFields.description = description;
    if (funding_stage) updateFields.funding_stage = funding_stage;
    if (team_size) updateFields.team_size = Number(team_size);

    await db.collection("startups").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updatedStartup = await db.collection("startups").findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: "Startup profile updated successfully",
      startup: updatedStartup
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update startup", error: error.message });
  }
});

// Delete Startup (Founder only)
router.delete("/:id", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    const startup = await db.collection("startups").findOne({ _id: new ObjectId(id) });
    if (!startup) {
      return res.status(404).json({ message: "Startup not found" });
    }

    if (startup.founder_email !== req.dbUser.email) {
      return res.status(403).json({ message: "Access Denied: You are not the owner of this startup" });
    }

    // Delete startup
    await db.collection("startups").deleteOne({ _id: new ObjectId(id) });
    // Delete associated opportunities
    await db.collection("opportunities").deleteMany({ startup_id: new ObjectId(id) });

    res.status(200).json({ success: true, message: "Startup profile and associated opportunities deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete startup", error: error.message });
  }
});

// Get All Startups (Public - only Approved ones, with pagination)
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 9 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skipNum = (pageNum - 1) * limitNum;

    const total = await db.collection("startups").countDocuments({ status: "Approved" });
    const startups = await db.collection("startups")
      .find({ status: "Approved" })
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .toArray();

    res.status(200).json({
      success: true,
      startups,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch startups", error: error.message });
  }
});

// Get Single Startup Details (Public)
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const startup = await db.collection("startups").findOne({ _id: new ObjectId(id) });
    if (!startup) {
      return res.status(404).json({ message: "Startup not found" });
    }

    res.status(200).json({ success: true, startup });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch startup details", error: error.message });
  }
});

export default router;
