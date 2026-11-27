
const mongoose = require("mongoose");
const crypto = require("crypto");
const axios = require("axios");
const { PDFParse } = require("pdf-parse");

const StoredFile = require("../models/File");
const Client = require("../models/Client");
const ClientAccess = require("../models/ClientAccess");
const ChecklistItem = require("../models/ChecklistItem");
const AISuggestion = require("../models/AISuggestion");
const ActivityLog = require("../models/ActivityLog");

const aiService = require("../services/aiService");
const { generatePrivateDownloadUrl } = require("../services/cloudinaryService");

const AUDITOR_MAX_CLIENTS = 2;

// ==========================================
// HELPER: CLIENT ACCESS VERIFICATION
// ==========================================

const canAccessClient = async (user, clientId) => {
  if (!user || !user._id || !user.firm_id || !mongoose.Types.ObjectId.isValid(clientId)) {
    return false;
  }

  const client = await Client.findOne({
    _id: clientId,
    firm_id: user.firm_id
  }).select("_id firm_id");

  if (!client) {
    return false;
  }

  if (user.role === "partner") {
    return true;
  }

  if (user.role === "client") {
    return String(user.client_id) === String(clientId);
  }

  if (user.role === "staff") {
    return Boolean(
      await ClientAccess.exists({
        person_id: user._id,
        client_id: clientId
      })
    );
  }

  if (user.role === "auditor") {
    const assignments = await ClientAccess.find({
      person_id: user._id
    })
      .sort({ created_at: 1, _id: 1 })
      .limit(AUDITOR_MAX_CLIENTS)
      .select("client_id")
      .lean();

    return assignments.some(
      (assignment) => String(assignment.client_id) === String(clientId)
    );
  }

  return false;
};

// ==========================================
// HELPER: RECORD ACTIVITY
// ==========================================

const recordActivity = async ({
  personId,
  clientId = null,
  fileId = null,
  action,
  blocked = false
}) => {
  if (!personId) return;

  try {
    await ActivityLog.create({
      person_id: personId,
      client_id: clientId,
      file_id: fileId,
      action,
      blocked
    });
  } catch (err) {
    console.error("Activity logging error:", err.message);
  }
};

// ==========================================
// 1. GET AI SERVICE HEALTH
// GET /api/ai/health
// ==========================================

const getAiHealth = async (req, res) => {
  try {
    const healthResult = await aiService.checkHealth();

    if (healthResult.success) {
      return res.status(200).json({
        success: true,
        service: "Standalone-AI",
        status: "healthy",
        upstream: healthResult.data
      });
    }

    return res.status(503).json({
      success: false,
      service: "Standalone-AI",
      status: "unhealthy",
      message: healthResult.error?.message || "AI microservice is unavailable."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to query AI health status."
    });
  }
};

// ==========================================
// 2. GENERATE CHECKLIST SUGGESTION
// POST /api/files/:fileId/ai-suggest
// ==========================================

const generateSuggestion = async (req, res) => {
  const user = req.user;
  const { fileId } = req.params;

  try {
    // 1. Role verification: only partner and staff can trigger suggestions
    if (!user || !user._id || !user.firm_id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (user.role === "client") {
      return res.status(403).json({
        success: false,
        message: "Clients cannot trigger internal AI checklist suggestions."
      });
    }

    if (user.role === "auditor") {
      return res.status(403).json({
        success: false,
        message: "Auditors have read-only access and cannot generate AI suggestions."
      });
    }

    if (!["partner", "staff"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to generate AI suggestions."
      });
    }

    // 2. Validate file ID
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document file ID."
      });
    }

    // 3. Find file in database
    const file = await StoredFile.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Document not found."
      });
    }

    // 4. Verify access to client associated with file
    const hasAccess = await canAccessClient(user, file.client_id);

    if (!hasAccess) {
      await recordActivity({
        personId: user._id,
        clientId: file.client_id,
        fileId: file._id,
        action: "ACCESS_BLOCKED",
        blocked: true
      });

      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this client document."
      });
    }

    // 5. Ensure document is a PDF for text extraction
    if (file.file_type !== "PDF") {
      return res.status(400).json({
        success: false,
        message: "AI checklist suggestions currently support PDF documents only."
      });
    }

    // 6. Fetch client's open checklist items
    const openChecklistItems = await ChecklistItem.find({
      client_id: file.client_id,
      done: false
    }).sort({ created_at: 1, _id: 1 }).lean();

    if (!openChecklistItems || openChecklistItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No open checklist items remaining for this client.",
        suggestion: null,
        openChecklistItemsCount: 0
      });
    }

    // 7. Securely retrieve document from Cloudinary into memory
    let documentBuffer;

    try {
      const privateUrl = generatePrivateDownloadUrl(file, 60);

      const downloadResponse = await axios.get(privateUrl, {
        responseType: "arraybuffer",
        timeout: 30000
      });

      documentBuffer = Buffer.from(downloadResponse.data);
    } catch (downloadErr) {
      console.error("Cloudinary document retrieval error:", downloadErr.message);

      return res.status(502).json({
        success: false,
        message: "Unable to retrieve document from storage for AI processing."
      });
    }

    // 8. Extract text from PDF in memory
    let extractedText = "";
    let parser = null;

    try {
      if (documentBuffer.length > 0) {
        parser = new PDFParse({ data: documentBuffer });
        const parseResult = await parser.getText();
        const rawText = parseResult?.text || "";
        // Strip pdf-parse page marker footers (e.g. "-- 1 of 1 --")
        extractedText = rawText.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
      }
    } catch (parseErr) {
      console.warn("PDF text extraction warning:", parseErr.message);
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch (destroyErr) {
          console.warn("Parser cleanup warning:", destroyErr.message);
        }
      }
    }

    // 9. Handle empty or scanned/image-only PDFs gracefully
    if (!extractedText || extractedText.length < 5) {
      return res.status(422).json({
        success: false,
        message: "No readable text could be extracted from this PDF. It may be an image scan or empty document.",
        isScannedOrEmpty: true,
        suggestion: null
      });
    }

    // 10. Call Standalone-AI microservice
    const requestId = crypto.randomUUID();

    const aiResult = await aiService.suggestChecklist({
      requestId,
      fileId: file._id.toString(),
      clientId: file.client_id.toString(),
      documentText: extractedText,
      openChecklistItems
    });

    // 11. Handle case where AI has no match
    if (!aiResult.suggestion) {
      return res.status(200).json({
        success: true,
        message: aiResult.message || "No confident checklist match found for this document.",
        suggestion: null,
        manualSelectionRequired: aiResult.manualSelectionRequired
      });
    }

    // 12. Validate that suggested checklist item belongs to the actual open checklist
    const suggestedItem = aiResult.suggestion;

    let matchedOpenItem = null;
    if (suggestedItem.checklist_item_id) {
      matchedOpenItem = openChecklistItems.find(
        (item) => String(item._id) === String(suggestedItem.checklist_item_id)
      );
    } else if (suggestedItem.checklist_item_name) {
      matchedOpenItem = openChecklistItems.find(
        (item) => item.name.toLowerCase() === suggestedItem.checklist_item_name.toLowerCase()
      );
    }

    if (!matchedOpenItem) {
      return res.status(422).json({
        success: false,
        message: "AI suggestion could not be verified against the client's open checklist.",
        suggestion: null
      });
    }

    // 13. Save suggestion as pending (NEVER automatically completes checklist)
    const newSuggestion = await AISuggestion.create({
      client_id: file.client_id,
      file_id: file._id,
      checklist_item_id: matchedOpenItem._id,
      checklist_item_name: matchedOpenItem.name,
      score: typeof suggestedItem.score === "number" ? suggestedItem.score : 0,
      reason: suggestedItem.reason || "Document matched open checklist item.",
      status: "pending",
      request_id: aiResult.requestId || requestId,
      suggested_by: user._id
    });

    // 14. Record activity log
    await recordActivity({
      personId: user._id,
      clientId: file.client_id,
      fileId: file._id,
      action: "AI_SUGGESTION_GENERATED",
      blocked: false
    });

    // 15. Return pending suggestion to frontend
    return res.status(201).json({
      success: true,
      message: "AI suggestion generated successfully. Review and approve or reject.",
      suggestion: {
        id: newSuggestion._id.toString(),
        client_id: newSuggestion.client_id.toString(),
        file_id: newSuggestion.file_id.toString(),
        checklist_item_id: newSuggestion.checklist_item_id.toString(),
        checklist_item_name: newSuggestion.checklist_item_name,
        score: newSuggestion.score,
        reason: newSuggestion.reason,
        status: newSuggestion.status,
        created_at: newSuggestion.created_at
      }
    });

  } catch (error) {
    if (error.isAiServiceError) {
      const statusCode = error.status || 503;
      return res.status(statusCode).json({
        success: false,
        message: error.message || "AI microservice error. Manual checklist completion remains available.",
        code: error.code
      });
    }

    console.error("Generate AI suggestion error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing the AI suggestion."
    });
  }
};

// ==========================================
// 3. GET SUGGESTIONS FOR A FILE
// GET /api/files/:fileId/ai-suggestions
// ==========================================

const getFileSuggestions = async (req, res) => {
  const user = req.user;
  const { fileId } = req.params;

  try {
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (user.role === "client") {
      return res.status(403).json({
        success: false,
        message: "Clients cannot access internal AI suggestions."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID."
      });
    }

    const file = await StoredFile.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Document not found."
      });
    }

    const hasAccess = await canAccessClient(user, file.client_id);

    if (!hasAccess) {
      await recordActivity({
        personId: user._id,
        clientId: file.client_id,
        fileId: file._id,
        action: "ACCESS_BLOCKED",
        blocked: true
      });

      return res.status(403).json({
        success: false,
        message: "You do not have access to this document."
      });
    }

    const suggestions = await AISuggestion.find({
      file_id: fileId
    })
      .sort({ created_at: -1 })
      .populate("suggested_by", "name email")
      .populate("reviewed_by", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      count: suggestions.length,
      suggestions: suggestions.map((s) => ({
        id: s._id.toString(),
        client_id: s.client_id.toString(),
        file_id: s.file_id.toString(),
        checklist_item_id: s.checklist_item_id.toString(),
        checklist_item_name: s.checklist_item_name,
        score: s.score,
        reason: s.reason,
        status: s.status,
        created_at: s.created_at,
        reviewed_at: s.reviewed_at,
        reviewed_by: s.reviewed_by ? s.reviewed_by.name : null
      }))
    });

  } catch (error) {
    console.error("Get file suggestions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve AI suggestions."
    });
  }
};

// ==========================================
// 4. APPROVE SUGGESTION
// PATCH /api/ai-suggestions/:id/approve
// ==========================================

const approveSuggestion = async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  try {
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    // Role check: Auditor is strictly read-only; Client has no access
    if (user.role === "auditor") {
      return res.status(403).json({
        success: false,
        message: "Auditors have read-only access and cannot approve suggestions."
      });
    }

    if (user.role === "client") {
      return res.status(403).json({
        success: false,
        message: "Clients cannot approve internal AI suggestions."
      });
    }

    if (!["partner", "staff"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to approve AI suggestions."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid suggestion ID."
      });
    }

    const suggestion = await AISuggestion.findById(id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: "Suggestion not found."
      });
    }

    // Prevent duplicate approval / review
    if (suggestion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This suggestion has already been reviewed (current status: ${suggestion.status}).`
      });
    }

    // Verify client access
    const hasAccess = await canAccessClient(user, suggestion.client_id);

    if (!hasAccess) {
      await recordActivity({
        personId: user._id,
        clientId: suggestion.client_id,
        fileId: suggestion.file_id || null,
        action: "ACCESS_BLOCKED",
        blocked: true
      });

      return res.status(403).json({
        success: false,
        message: "You do not have permission to review suggestions for this client."
      });
    }

    // 1. Atomically mark suggestion as approved with reviewer details (concurrency-safe)
    const updatedSuggestion = await AISuggestion.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewed_by: user._id,
          reviewed_at: new Date()
        }
      },
      { new: true }
    );

    if (!updatedSuggestion) {
      return res.status(409).json({
        success: false,
        message: "This suggestion has already been reviewed or updated concurrently."
      });
    }

    // 2. Mark corresponding ChecklistItem as done ONLY after explicit human approval
    const updatedChecklistItem = await ChecklistItem.findByIdAndUpdate(
      updatedSuggestion.checklist_item_id,
      { done: true },
      { new: true }
    );

    // 3. Link checklist_item_id to StoredFile if not already set
    await StoredFile.findByIdAndUpdate(
      updatedSuggestion.file_id,
      { checklist_item_id: updatedSuggestion.checklist_item_id }
    );

    // 4. Record ActivityLog
    await recordActivity({
      personId: user._id,
      clientId: updatedSuggestion.client_id,
      fileId: updatedSuggestion.file_id,
      action: "AI_SUGGESTION_APPROVED",
      blocked: false
    });

    return res.status(200).json({
      success: true,
      message: "AI suggestion approved and checklist item updated.",
      suggestion: {
        id: updatedSuggestion._id.toString(),
        status: updatedSuggestion.status,
        reviewed_by: user.name,
        reviewed_at: updatedSuggestion.reviewed_at
      },
      checklistItem: updatedChecklistItem
    });

  } catch (error) {
    console.error("Approve suggestion error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve AI suggestion."
    });
  }
};

// ==========================================
// 5. REJECT SUGGESTION
// PATCH /api/ai-suggestions/:id/reject
// ==========================================

const rejectSuggestion = async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  try {
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    // Role check: Auditor is strictly read-only; Client has no access
    if (user.role === "auditor") {
      return res.status(403).json({
        success: false,
        message: "Auditors have read-only access and cannot reject suggestions."
      });
    }

    if (user.role === "client") {
      return res.status(403).json({
        success: false,
        message: "Clients cannot reject internal AI suggestions."
      });
    }

    if (!["partner", "staff"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reject AI suggestions."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid suggestion ID."
      });
    }

    const suggestion = await AISuggestion.findById(id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: "Suggestion not found."
      });
    }

    // Prevent duplicate rejection / review
    if (suggestion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This suggestion has already been reviewed (current status: ${suggestion.status}).`
      });
    }

    // Verify client access
    const hasAccess = await canAccessClient(user, suggestion.client_id);

    if (!hasAccess) {
      await recordActivity({
        personId: user._id,
        clientId: suggestion.client_id,
        fileId: suggestion.file_id || null,
        action: "ACCESS_BLOCKED",
        blocked: true
      });

      return res.status(403).json({
        success: false,
        message: "You do not have permission to review suggestions for this client."
      });
    }

    // Mark suggestion as rejected with reviewer details (concurrency-safe)
    // ChecklistItem remains completely unchanged
    const updatedSuggestion = await AISuggestion.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewed_by: user._id,
          reviewed_at: new Date()
        }
      },
      { new: true }
    );

    if (!updatedSuggestion) {
      return res.status(409).json({
        success: false,
        message: "This suggestion has already been reviewed or updated concurrently."
      });
    }

    // Record ActivityLog
    await recordActivity({
      personId: user._id,
      clientId: updatedSuggestion.client_id,
      fileId: updatedSuggestion.file_id,
      action: "AI_SUGGESTION_REJECTED",
      blocked: false
    });

    return res.status(200).json({
      success: true,
      message: "AI suggestion rejected.",
      suggestion: {
        id: updatedSuggestion._id.toString(),
        status: updatedSuggestion.status,
        reviewed_by: user.name,
        reviewed_at: updatedSuggestion.reviewed_at
      }
    });

  } catch (error) {
    console.error("Reject suggestion error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject AI suggestion."
    });
  }
};

// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
  getAiHealth,
  generateSuggestion,
  getFileSuggestions,
  approveSuggestion,
  rejectSuggestion
};
