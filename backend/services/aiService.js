
const axios = require("axios");

/**
 * Helper to get sanitized configuration from environment variables.
 */
const getAiConfig = () => {
  const rawUrl = process.env.AI_SERVICE_URL || process.env.STANDALONE_AI_URL || "https://standalone-ai-clientlocker.onrender.com";
  const baseURL = rawUrl.replace(/\/+$/, "");
  const rawApiKey = (process.env.AI_SERVICE_API_KEY || process.env.STANDALONE_AI_API_KEY || process.env.AI_API_KEY || "").trim();
  const apiKey = rawApiKey.replace(/^["']|["']$/g, "").trim();
  const timeoutMs = parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || 60000;

  return {
    baseURL,
    apiKey,
    timeoutMs
  };
};

/**
 * Check health of Standalone-AI service.
 * GET /health
 */
const checkHealth = async () => {
  const { baseURL, timeoutMs } = getAiConfig();

  try {
    const response = await axios.get(`${baseURL}/health`, {
      timeout: Math.min(timeoutMs, 10000),
      headers: {
        Accept: "application/json"
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const errorDetails = parseAxiosError(error);
    console.error("AI service health check failed:", errorDetails.message);

    return {
      success: false,
      error: errorDetails
    };
  }
};

/**
 * Suggest a checklist item using the Standalone-AI microservice.
 * POST /api/v1/checklist/suggest
 *
 * Request format:
 * {
 *   "request_id": "...",
 *   "file_id": "...",
 *   "client_id": "...",
 *   "document_text": "...",
 *   "open_checklist_items": [
 *     { "id": "...", "name": "..." }
 *   ]
 * }
 */
const suggestChecklist = async ({
  requestId,
  fileId,
  clientId,
  documentText,
  openChecklistItems = []
}) => {
  const { baseURL, apiKey, timeoutMs } = getAiConfig();

  if (!baseURL) {
    throw new Error("AI service URL is not configured.");
  }

  // Format request body according to Standalone-AI specification
  const payload = {
    request_id: requestId ? String(requestId) : null,
    file_id: fileId ? String(fileId) : null,
    client_id: clientId ? String(clientId) : null,
    document_text: typeof documentText === "string" ? documentText : "",
    open_checklist_items: Array.isArray(openChecklistItems)
      ? openChecklistItems.map((item) => ({
          id: item.id || item._id ? String(item.id || item._id) : null,
          name: String(item.name || "").trim()
        }))
      : []
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  // Securely attach API key if provided (supports both X-API-Key and Bearer)
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await axios.post(
      `${baseURL}/api/v1/checklist/suggest`,
      payload,
      {
        headers,
        timeout: timeoutMs,
        maxContentLength: 10 * 1024 * 1024
      }
    );

    // Validate response schema
    const data = response.data;

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format received from AI service.");
    }

    if (data.success === false) {
      throw new Error(data.message || data.error || "AI service returned unsuccessful status.");
    }

    return {
      success: true,
      requestId: data.request_id || requestId,
      suggestion: data.suggestion || null,
      requiresApproval: data.requires_approval !== false,
      manualSelectionRequired: Boolean(data.manual_selection_required),
      message: data.message || null
    };

  } catch (error) {
    const errorDetails = parseAxiosError(error);

    // Safe logging without exposing secrets or document text
    console.error("AI checklist suggestion request error:", {
      status: errorDetails.status,
      code: errorDetails.code,
      message: errorDetails.message
    });

    const enrichedError = new Error(errorDetails.message);
    enrichedError.status = errorDetails.status;
    enrichedError.code = errorDetails.code;
    enrichedError.isAiServiceError = true;

    throw enrichedError;
  }
};

/**
 * Safely parse Axios errors without leaking sensitive headers or payload contents.
 */
const parseAxiosError = (error) => {
  if (error.response) {
    const status = error.response.status;
    const responseData = error.response.data;

    let message = "AI service returned an error.";

    if (status === 401 || status === 403) {
      message = "AI service authentication failed. Invalid API key.";
    } else if (status === 422) {
      const detailMsg = Array.isArray(responseData?.details)
        ? responseData.details.map((d) => d.msg || "").join("; ")
        : typeof responseData?.detail === "string"
          ? responseData.detail
          : "Invalid request data sent to AI service.";
      message = `AI service validation error: ${detailMsg}`;
    } else if (status >= 500) {
      message = "AI service encountered an internal error. Please try again later.";
    } else if (responseData?.message) {
      message = responseData.message;
    } else if (responseData?.detail) {
      message = typeof responseData.detail === "string"
        ? responseData.detail
        : JSON.stringify(responseData.detail);
    }

    return {
      status,
      code: `HTTP_${status}`,
      message
    };
  }

  if (error.code === "ECONNABORTED" || (error.message && error.message.includes("timeout"))) {
    return {
      status: 504,
      code: "AI_TIMEOUT",
      message: "The AI service timed out while analyzing the document."
    };
  }

  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "EHOSTUNREACH") {
    return {
      status: 503,
      code: "AI_UNAVAILABLE",
      message: "The AI microservice is currently unreachable. Normal manual checklist management remains available."
    };
  }

  return {
    status: 500,
    code: error.code || "AI_ERROR",
    message: error.message || "An unexpected error occurred while communicating with the AI service."
  };
};

module.exports = {
  getAiConfig,
  checkHealth,
  suggestChecklist
};
