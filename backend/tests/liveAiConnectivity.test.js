
const axios = require("axios");

describe("Live Deployed Standalone-AI Microservice Connectivity", () => {
  const liveUrl = "https://standalone-ai-clientlocker.onrender.com";

  // Real HTTP request to /health
  test("Live GET /health returns status 200 with healthy status", async () => {
    const response = await axios.get(`${liveUrl}/health`, {
      timeout: 60000,
      headers: { Accept: "application/json" }
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data.success).toBe(true);
    expect(response.data.service).toBe("Standalone-AI");
    expect(response.data.status).toBe("healthy");
  }, 65000);

  // Real HTTP request to /api/v1/status
  test("Live GET /api/v1/status returns engine metadata and capabilities", async () => {
    const response = await axios.get(`${liveUrl}/api/v1/status`, {
      timeout: 60000,
      headers: { Accept: "application/json" }
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.version).toBe("1.0.0");
    expect(response.data.engine_ready).toBe(true);
    expect(Array.isArray(response.data.capabilities)).toBe(true);
    expect(response.data.capabilities).toContain("checklist_suggestion");
  }, 65000);

  // Real HTTP request testing missing API key rejection
  test("Live POST /api/v1/checklist/suggest enforces API-Key requirement (returns 401 without key)", async () => {
    try {
      await axios.post(
        `${liveUrl}/api/v1/checklist/suggest`,
        {
          request_id: "probe-unauth",
          document_text: "Sample document text",
          open_checklist_items: [{ id: "item-1", name: "Form 1040" }]
        },
        {
          timeout: 60000,
          headers: { "Content-Type": "application/json" }
        }
      );
      throw new Error("Should have failed with 401");
    } catch (error) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(401);
      expect(error.response.data.detail).toMatch(/API key/i);
    }
  }, 65000);
});
