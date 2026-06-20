import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply to Opportunity (Collaborator only)
router.post("/", verifyToken, requireRole(["Collaborator"]), async (req, res) => {
  try {
    const { opportunity_id, portfolio_link, motivation } = req.body;
    const db = getDB();

    if (!opportunity_id || !portfolio_link || !motivation) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!ObjectId.isValid(opportunity_id)) {
      return res.status(400).json({ message: "Invalid Opportunity ID format" });
    }

    // Check if opportunity exists
    const opportunity = await db.collection("opportunities").findOne({ _id: new ObjectId(opportunity_id) });
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    // Check if user has already applied
    const existingApplication = await db.collection("applications").findOne({
      opportunity_id: new ObjectId(opportunity_id),
      applicant_email: req.dbUser.email
    });

    if (existingApplication) {
      return res.status(400).json({ message: "You have already applied for this opportunity" });
    }

    const newApplication = {
      opportunity_id: new ObjectId(opportunity_id),
      opportunity_title: opportunity.role_title,
      startup_name: opportunity.startup_name,
      applicant_email: req.dbUser.email,
      portfolio_link,
      motivation,
      status: "Pending", // Default status
      applied_at: new Date()
    };

    const result = await db.collection("applications").insertOne(newApplication);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application: { ...newApplication, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit application", error: error.message });
  }
});

// Get Collaborator's Applications (Collaborator only)
router.get("/my-applications", verifyToken, requireRole(["Collaborator"]), async (req, res) => {
  try {
    const db = getDB();
    const applications = await db.collection("applications")
      .find({ applicant_email: req.dbUser.email })
      .sort({ applied_at: -1 })
      .toArray();

    res.status(200).json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch applications", error: error.message });
  }
});

// Get Applications for Founder's Startups (Founder only)
router.get("/founder-applications", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    
    // Find all opportunities posted by this founder
    const founderOpportunities = await db.collection("opportunities")
      .find({ founder_email: req.dbUser.email })
      .toArray();

    const opportunityIds = founderOpportunities.map(opp => opp._id);

    // Find all applications for these opportunity IDs
    const applications = await db.collection("applications")
      .find({ opportunity_id: { $in: opportunityIds } })
      .sort({ applied_at: -1 })
      .toArray();

    // Attach applicant profiles (name, image) to applications for rich UI display
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        const applicant = await db.collection("users").findOne(
          { email: app.applicant_email },
          { projection: { name: 1, image: 1 } }
        );
        return {
          ...app,
          applicant_name: applicant ? applicant.name : "Unknown User",
          applicant_image: applicant ? applicant.image : ""
        };
      })
    );

    res.status(200).json({ success: true, applications: enrichedApplications });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch applications", error: error.message });
  }
});

// Accept or Reject Application (Founder only)
router.put("/:id/status", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;
    const db = getDB();

    if (!["Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'Accepted' or 'Rejected'" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Application ID format" });
    }

    const application = await db.collection("applications").findOne({ _id: new ObjectId(id) });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Verify if this application corresponds to an opportunity belonging to the founder
    const opportunity = await db.collection("opportunities").findOne({ _id: application.opportunity_id });
    if (!opportunity || opportunity.founder_email !== req.dbUser.email) {
      return res.status(403).json({ message: "Access Denied: You are not authorized to manage this application" });
    }

    await db.collection("applications").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `Application has been ${status.toLowerCase()} successfully`,
      status
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update application status", error: error.message });
  }
});

export default router;
