import express from "express";
import Stripe from "stripe";
import { getDB } from "../db.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY is not set. Payment features will fall back to mock mode.");
}
// Initialize Stripe (guard against undefined key)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Create Checkout Session
router.post("/create-checkout-session", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const db = getDB();
    
    // Check if user already has a premium payment
    const existingPayment = await db.collection("payments").findOne({
      user_email: req.dbUser.email,
      payment_status: "succeeded"
    });

    if (existingPayment) {
      return res.status(400).json({ message: "You already have a Premium subscription" });
    }

    if (!stripe) {
      return res.status(503).json({ message: "Payment service is not configured (missing STRIPE_SECRET_KEY)" });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "StartupForge Founder Premium Plan",
              description: "Post unlimited opportunities and access detailed team analytics",
              images: ["https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400"],
            },
            unit_amount: 4900, // $49.00 USD
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/dashboard/my-startup`,
      customer_email: req.dbUser.email,
      metadata: {
        user_email: req.dbUser.email
      }
    });

    res.status(200).json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    if (isProduction) {
      return res.status(500).json({ message: "Payment service is currently unavailable" });
    }
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const mockSessionId = `mock_session_${Date.now()}`;
    res.status(200).json({
      success: true,
      url: `${clientUrl}/dashboard/payment-success?session_id=${mockSessionId}`,
      sessionId: mockSessionId,
      mock: true,
      message: "Mock payment session created (Stripe unavailable)"
    });
  }
});

// Verify Stripe Session & Save Payment
router.post("/verify-session", verifyToken, requireRole(["Founder"]), async (req, res) => {
  try {
    const { session_id } = req.body;
    const db = getDB();

    if (!session_id) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment has not been completed or session is invalid" });
    }

    // Check if this transaction has already been stored
    const existingTransaction = await db.collection("payments").findOne({
      transaction_id: session.payment_intent
    });

    if (existingTransaction) {
      return res.status(200).json({
        success: true,
        message: "Payment verified (already processed)",
        payment: existingTransaction
      });
    }

    const newPayment = {
      user_email: session.customer_email || session.metadata.user_email || req.dbUser.email,
      amount: session.amount_total / 100, // Convert cents to dollars
      transaction_id: session.payment_intent || session.id,
      payment_status: "succeeded",
      paid_at: new Date()
    };

    const result = await db.collection("payments").insertOne(newPayment);

    res.status(201).json({
      success: true,
      message: "Payment successfully verified and premium activated",
      payment: { ...newPayment, _id: result.insertedId }
    });
  } catch (error) {
    if (isProduction) {
      return res.status(500).json({ message: "Payment verification failed" });
    }
    // Mock fallback for local development only
    try {
      const db = getDB();
      const existingMock = await db.collection("payments").findOne({
        user_email: req.dbUser.email,
        payment_status: "succeeded"
      });
      if (existingMock) {
        return res.status(200).json({
          success: true,
          message: "Payment already active (mock)",
          payment: existingMock
        });
      }
      const mockPayment = {
        user_email: req.dbUser.email,
        amount: 49,
        transaction_id: `mock_tx_${Date.now()}`,
        payment_status: "succeeded",
        paid_at: new Date()
      };
      await db.collection("payments").insertOne(mockPayment);
      return res.status(201).json({
        success: true,
        message: "Mock payment successfully processed for local environment",
        payment: mockPayment
      });
    } catch (mockErr) {
      res.status(500).json({ message: "Payment verification failed", error: error.message });
    }
  }
});

// Get Premium Status
router.get("/status", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const payment = await db.collection("payments").findOne({
      user_email: req.dbUser.email,
      payment_status: "succeeded"
    });

    res.status(200).json({
      success: true,
      isPremium: !!payment,
      payment: payment || null
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch premium status", error: error.message });
  }
});

export default router;
