
const express = require("express");
const router = express.Router();

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const {
  getAiHealth,
  generateSuggestion,
  getFileSuggestions,
  approveSuggestion,
  rejectSuggestion
} = require("../controllers/aiController");

// ==========================================
// AI MICROSERVICE HEALTH CHECK
// Partner and staff
// ==========================================

router.get(
  "/ai/health",
  protect,
  authorize("partner", "staff"),
  getAiHealth
);

// ==========================================
// GENERATE AI CHECKLIST SUGGESTION
// Partner and assigned staff only
// ==========================================

router.post(
  "/files/:fileId/ai-suggest",
  protect,
  authorize("partner", "staff"),
  generateSuggestion
);

// ==========================================
// GET SUGGESTIONS FOR A FILE
// Partner, staff, and auditor (read-only)
// ==========================================

router.get(
  "/files/:fileId/ai-suggestions",
  protect,
  authorize("partner", "staff", "auditor"),
  getFileSuggestions
);

// ==========================================
// APPROVE AI SUGGESTION
// Partner and assigned staff only
// ==========================================

router.patch(
  "/ai-suggestions/:id/approve",
  protect,
  authorize("partner", "staff"),
  approveSuggestion
);

// ==========================================
// REJECT AI SUGGESTION
// Partner and assigned staff only
// ==========================================

router.patch(
  "/ai-suggestions/:id/reject",
  protect,
  authorize("partner", "staff"),
  rejectSuggestion
);

module.exports = router;
