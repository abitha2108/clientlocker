
const request = require("supertest");
const mongoose = require("mongoose");
const axios = require("axios");

// Set environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-minimum-32-chars-long";
process.env.AI_SERVICE_URL = "https://standalone-ai-clientlocker.onrender.com";
process.env.AI_SERVICE_API_KEY = "test-ai-key-secret";
process.env.AI_SERVICE_TIMEOUT_MS = "5000";

const app = require("../server");
const aiService = require("../services/aiService");
const { generateToken } = require("../utils/jwt");

const Person = require("../models/Person");
const Client = require("../models/Client");
const ClientAccess = require("../models/ClientAccess");
const StoredFile = require("../models/File");
const ChecklistItem = require("../models/ChecklistItem");
const AISuggestion = require("../models/AISuggestion");
const ActivityLog = require("../models/ActivityLog");

// Mock axios
jest.mock("axios");

// Mock PDFParse
jest.mock("pdf-parse", () => {
  return {
    PDFParse: jest.fn().mockImplementation((opts) => {
      return {
        getText: jest.fn().mockImplementation(async () => {
          const buf = opts.data;
          // If empty buffer or special flag
          if (!buf || buf.length === 0 || buf.toString() === "EMPTY_PDF") {
            return { text: "" };
          }
          if (buf.toString() === "IMAGE_ONLY_PDF") {
            return { text: "\n\n-- 1 of 1 --\n\n" };
          }
          return { text: "Form 1040 U.S. Individual Income Tax Return 2024 Taxable income" };
        }),
        destroy: jest.fn().mockResolvedValue(true)
      };
    })
  };
});

describe("Standalone-AI Microservice Integration Test Suite", () => {
  const firmId = new mongoose.Types.ObjectId();
  const partnerId = new mongoose.Types.ObjectId();
  const assignedStaffId = new mongoose.Types.ObjectId();
  const unassignedStaffId = new mongoose.Types.ObjectId();
  const auditorId = new mongoose.Types.ObjectId();
  const clientRoleId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const otherFirmClientId = new mongoose.Types.ObjectId();
  const fileId = new mongoose.Types.ObjectId();
  const checklistItemId = new mongoose.Types.ObjectId();
  const suggestionId = new mongoose.Types.ObjectId();

  const partnerUser = {
    _id: partnerId,
    name: "Partner Vel",
    email: "partner@test.com",
    role: "partner",
    firm_id: firmId,
    is_active: true
  };

  const assignedStaffUser = {
    _id: assignedStaffId,
    name: "Staff Abitha",
    email: "abitha@test.com",
    role: "staff",
    firm_id: firmId,
    is_active: true
  };

  const unassignedStaffUser = {
    _id: unassignedStaffId,
    name: "Staff Other",
    email: "other@test.com",
    role: "staff",
    firm_id: firmId,
    is_active: true
  };

  const auditorUser = {
    _id: auditorId,
    name: "Auditor John",
    email: "auditor@test.com",
    role: "auditor",
    firm_id: firmId,
    is_active: true
  };

  const clientRoleUser = {
    _id: clientRoleId,
    name: "Client Raman",
    email: "raman@test.com",
    role: "client",
    client_id: clientId,
    firm_id: firmId,
    is_active: true
  };

  let partnerToken;
  let assignedStaffToken;
  let unassignedStaffToken;
  let auditorToken;
  let clientToken;

  beforeAll(() => {
    partnerToken = generateToken(partnerUser);
    assignedStaffToken = generateToken(assignedStaffUser);
    unassignedStaffToken = generateToken(unassignedStaffUser);
    auditorToken = generateToken(auditorUser);
    clientToken = generateToken(clientRoleUser);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Person.findOne mock for auth middleware
    jest.spyOn(Person, "findOne").mockImplementation(({ _id }) => {
      const idStr = String(_id);
      let found = null;
      if (idStr === String(partnerId)) found = partnerUser;
      if (idStr === String(assignedStaffId)) found = assignedStaffUser;
      if (idStr === String(unassignedStaffId)) found = unassignedStaffUser;
      if (idStr === String(auditorId)) found = auditorUser;
      if (idStr === String(clientRoleId)) found = clientRoleUser;

      return {
        select: jest.fn().mockResolvedValue(found)
      };
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ========================================================
  // 1. AI Service Connection & Health Check (Mocked Unit Test)
  // ========================================================
  test("1. AI service connection: successfully performs health check via service", async () => {
    axios.get.mockResolvedValueOnce({
      data: { success: true, service: "Standalone-AI", status: "healthy" }
    });

    const res = await request(app)
      .get("/api/ai/health")
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe("Standalone-AI");
    expect(res.body.status).toBe("healthy");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.any(Object)
    );
  });

  // ========================================================
  // 2. API-Key Authentication
  // ========================================================
  test("2. API-key authentication: sends X-API-Key header to microservice", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "req-1",
        suggestion: {
          checklist_item_id: checklistItemId.toString(),
          checklist_item_name: "Form 1040 Tax Return",
          score: 90,
          reason: "Tax return identified"
        },
        requires_approval: true
      }
    });

    const result = await aiService.suggestChecklist({
      requestId: "req-1",
      fileId: fileId.toString(),
      clientId: clientId.toString(),
      documentText: "Form 1040 document text",
      openChecklistItems: [{ id: checklistItemId.toString(), name: "Form 1040 Tax Return" }]
    });

    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/checklist/suggest"),
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "test-ai-key-secret"
        })
      })
    );
  });

  // ========================================================
  // 3. Successful Checklist Suggestion
  // ========================================================
  test("3. Successful checklist suggestion: formats request payload and parses response", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "test-req-3",
        suggestion: {
          checklist_item_id: checklistItemId.toString(),
          checklist_item_name: "Form 1040 Tax Return",
          score: 88,
          reason: "Matched tax form keywords"
        },
        requires_approval: true,
        manual_selection_required: true,
        message: null
      }
    });

    const result = await aiService.suggestChecklist({
      requestId: "test-req-3",
      fileId: fileId.toString(),
      clientId: clientId.toString(),
      documentText: "Income Tax Form 1040",
      openChecklistItems: [{ id: checklistItemId.toString(), name: "Form 1040 Tax Return" }]
    });

    expect(result.success).toBe(true);
    expect(result.suggestion.score).toBe(88);
    expect(result.suggestion.checklist_item_name).toBe("Form 1040 Tax Return");
    expect(result.requiresApproval).toBe(true);
  });

  // ========================================================
  // 4. Invalid AI Response
  // ========================================================
  test("4. Invalid AI response: handles malformed or unsuccessful response gracefully", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: false,
        message: "Engine could not process request."
      }
    });

    await expect(
      aiService.suggestChecklist({
        requestId: "req-err",
        fileId: fileId.toString(),
        clientId: clientId.toString(),
        documentText: "Some text",
        openChecklistItems: []
      })
    ).rejects.toThrow("Engine could not process request.");
  });

  // ========================================================
  // 5. AI Timeout
  // ========================================================
  test("5. AI timeout: handles ECONNABORTED with status 504", async () => {
    const timeoutError = new Error("timeout of 5000ms exceeded");
    timeoutError.code = "ECONNABORTED";
    axios.post.mockRejectedValueOnce(timeoutError);

    try {
      await aiService.suggestChecklist({
        requestId: "req-timeout",
        fileId: fileId.toString(),
        clientId: clientId.toString(),
        documentText: "Some text",
        openChecklistItems: []
      });
      throw new Error("Should have thrown");
    } catch (err) {
      expect(err.status).toBe(504);
      expect(err.code).toBe("AI_TIMEOUT");
      expect(err.message).toContain("timed out");
    }
  });

  // ========================================================
  // 6. AI Service Unavailable
  // ========================================================
  test("6. AI service unavailable: handles ECONNREFUSED with status 503", async () => {
    const connError = new Error("connect ECONNREFUSED 127.0.0.1:8000");
    connError.code = "ECONNREFUSED";
    axios.post.mockRejectedValueOnce(connError);

    try {
      await aiService.suggestChecklist({
        requestId: "req-unavail",
        fileId: fileId.toString(),
        clientId: clientId.toString(),
        documentText: "Some text",
        openChecklistItems: []
      });
      throw new Error("Should have thrown");
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.code).toBe("AI_UNAVAILABLE");
      expect(err.message).toContain("unreachable");
    }
  });

  // ========================================================
  // 7. Empty and Image-Only PDF Handling
  // ========================================================
  test("7. Empty PDF: returns 422 with clear message when text cannot be extracted", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: checklistItemId, name: "Form 1040", done: false }
        ])
      })
    });

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("EMPTY_PDF")
    });

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.isScannedOrEmpty).toBe(true);
    expect(res.body.message).toContain("No readable text could be extracted");
  });

  test("7b. Image-only PDF: strips page markers and returns 422", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: checklistItemId, name: "Form 1040", done: false }
        ])
      })
    });

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("IMAGE_ONLY_PDF")
    });

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.isScannedOrEmpty).toBe(true);
  });

  // ========================================================
  // 8. Unauthorized Staff (Unauthenticated request)
  // ========================================================
  test("8. Unauthorized staff: rejects requests without valid authentication token", async () => {
    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ========================================================
  // 9. Unassigned Staff Access Denial
  // ========================================================
  test("9. Unassigned staff: rejects staff member not assigned to client", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ClientAccess, "exists").mockResolvedValueOnce(null);
    const activitySpy = jest.spyOn(ActivityLog, "create").mockResolvedValue({});

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${unassignedStaffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("permission");
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ACCESS_BLOCKED",
        blocked: true
      })
    );
  });

  // ========================================================
  // 10. Client Role Access Denial
  // ========================================================
  test("10. Client access denial: client role cannot trigger internal AI suggestions", async () => {
    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("permission");
  });

  // ========================================================
  // 11. Auditor Approval Denial
  // ========================================================
  test("11. Auditor approval denial: auditors cannot approve suggestions (read-only)", async () => {
    const res = await request(app)
      .patch(`/api/ai-suggestions/${suggestionId}/approve`)
      .set("Authorization", `Bearer ${auditorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("permission");
  });

  // ========================================================
  // 12. Valid Human Approval
  // ========================================================
  test("12. Valid human approval: updates suggestion, marks checklist item done, logs activity", async () => {
    const mockSuggestion = {
      _id: suggestionId,
      client_id: clientId,
      file_id: fileId,
      checklist_item_id: checklistItemId,
      status: "pending"
    };

    jest.spyOn(AISuggestion, "findById").mockResolvedValueOnce(mockSuggestion);

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    const updatedMockSuggestion = {
      ...mockSuggestion,
      status: "approved",
      reviewed_by: partnerUser._id,
      reviewed_at: new Date()
    };

    jest.spyOn(AISuggestion, "findOneAndUpdate").mockResolvedValueOnce(updatedMockSuggestion);

    const updateChecklistSpy = jest.spyOn(ChecklistItem, "findByIdAndUpdate").mockResolvedValueOnce({
      _id: checklistItemId,
      done: true
    });

    jest.spyOn(StoredFile, "findByIdAndUpdate").mockResolvedValueOnce({});
    const activitySpy = jest.spyOn(ActivityLog, "create").mockResolvedValue({});

    const res = await request(app)
      .patch(`/api/ai-suggestions/${suggestionId}/approve`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.suggestion.status).toBe("approved");
    expect(updateChecklistSpy).toHaveBeenCalledWith(
      checklistItemId,
      { done: true },
      { new: true }
    );
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AI_SUGGESTION_APPROVED",
        person_id: partnerId
      })
    );
  });

  // ========================================================
  // 12b. Concurrent / Duplicate Approval Attempt
  // ========================================================
  test("12b. Concurrent approval attempt: returns 409 Conflict if already approved", async () => {
    const mockSuggestion = {
      _id: suggestionId,
      client_id: clientId,
      file_id: fileId,
      checklist_item_id: checklistItemId,
      status: "pending"
    };

    jest.spyOn(AISuggestion, "findById").mockResolvedValueOnce(mockSuggestion);

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    // findOneAndUpdate returns null (another process already transitioned it)
    jest.spyOn(AISuggestion, "findOneAndUpdate").mockResolvedValueOnce(null);

    const res = await request(app)
      .patch(`/api/ai-suggestions/${suggestionId}/approve`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("already been reviewed");
  });

  // ========================================================
  // 13. Valid Rejection
  // ========================================================
  test("13. Valid rejection: updates status to rejected without modifying checklist item", async () => {
    const mockSuggestion = {
      _id: suggestionId,
      client_id: clientId,
      file_id: fileId,
      checklist_item_id: checklistItemId,
      status: "pending"
    };

    jest.spyOn(AISuggestion, "findById").mockResolvedValueOnce(mockSuggestion);

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    const updatedMockSuggestion = {
      ...mockSuggestion,
      status: "rejected",
      reviewed_by: partnerUser._id,
      reviewed_at: new Date()
    };

    jest.spyOn(AISuggestion, "findOneAndUpdate").mockResolvedValueOnce(updatedMockSuggestion);

    const updateChecklistSpy = jest.spyOn(ChecklistItem, "findByIdAndUpdate");
    const activitySpy = jest.spyOn(ActivityLog, "create").mockResolvedValue({});

    const res = await request(app)
      .patch(`/api/ai-suggestions/${suggestionId}/reject`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.suggestion.status).toBe("rejected");
    expect(updateChecklistSpy).not.toHaveBeenCalled();
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AI_SUGGESTION_REJECTED",
        person_id: partnerId
      })
    );
  });

  // ========================================================
  // 14. ActivityLog Creation on Suggestion Generation
  // ========================================================
  test("14. ActivityLog creation: records AI_SUGGESTION_GENERATED on successful suggestion", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: checklistItemId, name: "Form 1040 Tax Return", done: false }
        ])
      })
    });

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("Valid PDF data")
    });

    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "req-act-14",
        suggestion: {
          checklist_item_id: checklistItemId.toString(),
          checklist_item_name: "Form 1040 Tax Return",
          score: 85,
          reason: "Found 1040 form text"
        },
        requires_approval: true
      }
    });

    jest.spyOn(AISuggestion, "create").mockResolvedValueOnce({
      _id: suggestionId,
      client_id: clientId,
      file_id: fileId,
      checklist_item_id: checklistItemId,
      checklist_item_name: "Form 1040 Tax Return",
      score: 85,
      reason: "Found 1040 form text",
      status: "pending",
      created_at: new Date()
    });

    const activitySpy = jest.spyOn(ActivityLog, "create").mockResolvedValue({});

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(201);
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AI_SUGGESTION_GENERATED",
        person_id: partnerId,
        client_id: clientId,
        file_id: fileId
      })
    );
  });

  // ========================================================
  // 15. AI Never Automatically Completes Checklist Items
  // ========================================================
  test("15. AI never automatically completes checklist items: item remains done=false upon suggestion", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    const mockChecklistItem = {
      _id: checklistItemId,
      name: "Form 1040 Tax Return",
      done: false
    };

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockChecklistItem])
      })
    });

    const updateChecklistSpy = jest.spyOn(ChecklistItem, "findByIdAndUpdate");
    const saveChecklistSpy = jest.spyOn(ChecklistItem.prototype, "save");

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("Valid PDF data")
    });

    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "req-auto-15",
        suggestion: {
          checklist_item_id: checklistItemId.toString(),
          checklist_item_name: "Form 1040 Tax Return",
          score: 95,
          reason: "100% matched tax return"
        },
        requires_approval: true
      }
    });

    jest.spyOn(AISuggestion, "create").mockResolvedValueOnce({
      _id: suggestionId,
      client_id: clientId,
      file_id: fileId,
      checklist_item_id: checklistItemId,
      checklist_item_name: "Form 1040 Tax Return",
      score: 95,
      reason: "100% matched tax return",
      status: "pending",
      created_at: new Date()
    });

    jest.spyOn(ActivityLog, "create").mockResolvedValue({});

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.suggestion.status).toBe("pending");

    // CRITICAL: Checklist item must NOT have been updated or saved as done
    expect(updateChecklistSpy).not.toHaveBeenCalled();
    expect(saveChecklistSpy).not.toHaveBeenCalled();
    expect(mockChecklistItem.done).toBe(false);
  });

  // ========================================================
  // 16. Invalid Checklist Item ID Returned by AI
  // ========================================================
  test("16. Invalid checklist item ID from AI: rejects suggestion with 422", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: checklistItemId, name: "Form 1040 Tax Return", done: false }
        ])
      })
    });

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("Valid PDF data")
    });

    // Standalone-AI returns an ID not present in open items
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "req-invalid-id",
        suggestion: {
          checklist_item_id: new mongoose.Types.ObjectId().toString(),
          checklist_item_name: "Unrelated Item",
          score: 80,
          reason: "Spurious match"
        },
        requires_approval: true
      }
    });

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("could not be verified");
  });

  // ========================================================
  // 17. Low-Confidence Suggestion (Null Suggestion from AI)
  // ========================================================
  test("17. Low-confidence suggestion: returns 200 with suggestion=null", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: clientId,
      file_type: "PDF",
      storage_path: "path/doc",
      cloudinary_resource_type: "raw"
    });

    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: clientId, firm_id: firmId })
    });

    jest.spyOn(ChecklistItem, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: checklistItemId, name: "Form 1040 Tax Return", done: false }
        ])
      })
    });

    axios.get.mockResolvedValueOnce({
      data: Buffer.from("Valid PDF data")
    });

    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        request_id: "req-low-conf",
        suggestion: null,
        requires_approval: true,
        manual_selection_required: true,
        message: "No checklist match met the confidence threshold."
      }
    });

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.suggestion).toBeNull();
    expect(res.body.manualSelectionRequired).toBe(true);
  });

  // ========================================================
  // 18. Cross-Firm Document Isolation
  // ========================================================
  test("18. Cross-firm isolation: rejects document belonging to another firm", async () => {
    jest.spyOn(StoredFile, "findById").mockResolvedValueOnce({
      _id: fileId,
      client_id: otherFirmClientId,
      file_type: "PDF"
    });

    // Client.findOne with firm_id matching partner returns null because client belongs to other firm
    jest.spyOn(Client, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    const res = await request(app)
      .post(`/api/files/${fileId}/ai-suggest`)
      .set("Authorization", `Bearer ${partnerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
