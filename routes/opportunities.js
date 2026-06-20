import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create Opportunity (Founder only, Stripe quota restriction)
router.post("/", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { role_title, required_skills, work_type, commitment_level, deadline } = req.body;
    const db = getDB();

    if (!role_title || !required_skills || !work_type || !commitment_level || !deadline) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Retrieve founder's startup profile
    const startup = await db.collection("startups").findOne({ founder_email: req.dbUser.email });
    if (!startup) {
      return res.status(400).json({ message: "You must create a startup profile before posting opportunities" });
    }

    if (startup.status !== "Approved") {
      return res.status(400).json({ message: "Your startup profile must be approved by the admin before posting opportunities" });
    }

    // Check quota: max 3 free opportunities unless premium
    const opportunityCount = await db.collection("opportunities").countDocuments({ founder_email: req.dbUser.email });
    
    if (opportunityCount >= 3) {
      // Check if user has premium status
      const payment = await db.collection("payments").findOne({
        user_email: req.dbUser.email,
        payment_status: "succeeded"
      });

      if (!payment) {
        return res.status(403).json({
          success: false,
          premiumRequired: true,
          message: "You have reached the limit of 3 free opportunities. Please upgrade to premium to post more."
        });
      }
    }

    const newOpportunity = {
      startup_id: startup._id,
      startup_name: startup.startup_name,
      founder_email: req.dbUser.email,
      industry: startup.industry, // For filtering opportunities by industry
      role_title,
      required_skills: Array.isArray(required_skills)
        ? required_skills
        : required_skills.split(",").map(s => s.trim()).filter(Boolean),
      work_type, // Remote, Hybrid, On-site
      commitment_level, // Full-time, Part-time, Contract
      deadline: new Date(deadline),
      createdAt: new Date()
    };

    const result = await db.collection("opportunities").insertOne(newOpportunity);

    res.status(201).json({
      success: true,
      message: "Opportunity posted successfully",
      opportunity: { ...newOpportunity, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to post opportunity", error: error.message });
  }
});

// Update Opportunity (Founder only)
router.put("/:id", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { role_title, required_skills, work_type, commitment_level, deadline } = req.body;
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const opportunity = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (opportunity.founder_email !== req.dbUser.email) {
      return res.status(403).json({ message: "Access Denied: You are not the poster of this opportunity" });
    }

    const updateFields = {};
    if (role_title) updateFields.role_title = role_title;
    if (required_skills) {
      updateFields.required_skills = Array.isArray(required_skills)
        ? required_skills
        : required_skills.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (work_type) updateFields.work_type = work_type;
    if (commitment_level) updateFields.commitment_level = commitment_level;
    if (deadline) updateFields.deadline = new Date(deadline);

    await db.collection("opportunities").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updated = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: "Opportunity updated successfully",
      opportunity: updated
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update opportunity", error: error.message });
  }
});

// Delete Opportunity (Founder only)
router.delete("/:id", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const opportunity = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (opportunity.founder_email !== req.dbUser.email) {
      return res.status(403).json({ message: "Access Denied: You are not the poster of this opportunity" });
    }

    await db.collection("opportunities").deleteOne({ _id: new ObjectId(id) });
    // Delete associated applications
    await db.collection("applications").deleteMany({ opportunity_id: new ObjectId(id) });

    res.status(200).json({ success: true, message: "Opportunity and associated applications deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete opportunity", error: error.message });
  }
});

// Get Founder's posted opportunities (Founder only)
router.get("/my-postings", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    const opportunities = await db.collection("opportunities")
      .find({ founder_email: req.dbUser.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, opportunities });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch opportunities", error: error.message });
  }
});

// Get All Opportunities with Search, Filter & Server-side Pagination (Public)
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const { search, workType, industry, page = 1, limit = 6 } = req.query;

    const query = {};

    // 1. Search by role_title or required_skills using MongoDB $regex
    if (search) {
      query.$or = [
        { role_title: { $regex: search, $options: "i" } },
        { required_skills: { $regex: search, $options: "i" } }
      ];
    }

    // 2. Filter using MongoDB $in or strict match
    if (workType) {
      const workTypes = Array.isArray(workType) ? workType : workType.split(",");
      query.work_type = { $in: workTypes };
    }

    if (industry) {
      const industries = Array.isArray(industry) ? industry : industry.split(",");
      query.industry = { $in: industries };
    }

    // Server-side pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skipNum = (pageNum - 1) * limitNum;

    const total = await db.collection("opportunities").countDocuments(query);
    const opportunities = await db.collection("opportunities")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .toArray();

    res.status(200).json({
      success: true,
      opportunities,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch opportunities", error: error.message });
  }
});

// Get Single Opportunity Details (Public)
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const opportunity = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    res.status(200).json({ success: true, opportunity });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch opportunity details", error: error.message });
  }
});

export default router;
