
import { useState } from "react";
import {
  openClientFile,
  suggestChecklistForFile,
  approveAiSuggestion,
  rejectAiSuggestion,
  getFileSuggestions
} from "../services/api";
import "./FileList.css";

export default function FileList({
  clientId,
  files = [],
  onRefresh
}) {
  const [openingId, setOpeningId] = useState(null);
  const [suggestingId, setSuggestingId] = useState(null);
  const [error, setError] = useState("");

  // AI Suggestion Modal State
  const [activeModalFile, setActiveModalFile] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) {
      return "—";
    }

    const size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) {
      return "—";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    return `${(size / 1024).toFixed(1)} KB`;
  };

  // ==========================================
  // OPEN FILE USING AUTHENTICATED DOWNLOAD
  // ==========================================

  const handleOpen = async (file) => {
    const fileId = file.id || file._id;

    if (!fileId) {
      setError("Unable to open document. File ID is missing.");
      return;
    }

    let newTab = null;
    let objectUrl = null;

    try {
      setOpeningId(fileId);
      setError("");

      newTab = window.open("about:blank", "_blank");

      if (!newTab) {
        throw new Error(
          "Your browser blocked the document tab. Please allow pop-ups and try again."
        );
      }

      newTab.opener = null;
      newTab.document.title = "Opening ClientLocker document...";
      newTab.document.body.innerHTML =
        "<p style='font-family:Arial,sans-serif;padding:24px'>Opening secure document...</p>";

      const result = await openClientFile(fileId);

      const blob =
        result instanceof Blob
          ? result
          : result?.blob instanceof Blob
            ? result.blob
            : null;

      if (!blob || blob.size === 0) {
        throw new Error("The document could not be downloaded.");
      }

      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png"
      ];

      const contentType = blob.type
        ? blob.type.split(";")[0].trim().toLowerCase()
        : "";

      if (contentType && !allowedTypes.includes(contentType)) {
        throw new Error("Unsupported document format.");
      }

      objectUrl = window.URL.createObjectURL(blob);
      newTab.location.replace(objectUrl);
      objectUrl = null;

    } catch (err) {
      console.error("File opening error:", err);

      if (newTab && !newTab.closed) {
        newTab.close();
      }

      setError(
        err.message ||
        "Unable to open document. Please try again."
      );
    } finally {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }

      setOpeningId(null);
    }
  };

  // ==========================================
  // AI SUGGEST ACTION
  // ==========================================

  const handleAiSuggest = async (file) => {
    const fileId = file.id || file._id;

    if (!fileId) {
      setError("Unable to request suggestion. File ID is missing.");
      return;
    }

    setActiveModalFile(file);
    setAiLoading(true);
    setAiError("");
    setAiSuggestion(null);
    setActionSuccess("");
    setSuggestingId(fileId);

    try {
      // 1. First check if an existing suggestion exists for this file
      let existingSuggestion = null;
      try {
        const history = await getFileSuggestions(fileId);
        if (history?.suggestions && history.suggestions.length > 0) {
          existingSuggestion = history.suggestions[0];
        }
      } catch {
        // Continue to fresh generation if history query is skipped
      }

      // If there is an existing pending suggestion, display it directly
      if (existingSuggestion && existingSuggestion.status === "pending") {
        setAiSuggestion(existingSuggestion);
        setAiLoading(false);
        setSuggestingId(null);
        return;
      }

      // 2. Trigger fresh suggestion generation from backend
      const response = await suggestChecklistForFile(fileId);

      if (response?.suggestion) {
        setAiSuggestion(response.suggestion);
      } else {
        setAiError(
          response?.message ||
          "No matching open checklist items were identified for this document."
        );
      }
    } catch (err) {
      console.error("AI suggest error:", err);
      setAiError(
        err.message ||
        "AI microservice is unavailable. You may continue to process checklists manually."
      );
    } finally {
      setAiLoading(false);
      setSuggestingId(null);
    }
  };

  // ==========================================
  // APPROVE SUGGESTION
  // ==========================================

  const handleApprove = async () => {
    if (!aiSuggestion?.id) return;

    try {
      setActionLoading(true);
      setError("");

      const response = await approveAiSuggestion(aiSuggestion.id);

      setAiSuggestion((prev) => ({
        ...prev,
        status: "approved",
        reviewed_by: response?.suggestion?.reviewed_by || "Current User",
        reviewed_at: response?.suggestion?.reviewed_at || new Date().toISOString()
      }));

      setActionSuccess("Suggestion approved! Checklist item marked as completed.");

      if (typeof onRefresh === "function") {
        onRefresh();
      }
    } catch (err) {
      setAiError(err.message || "Failed to approve suggestion.");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // REJECT SUGGESTION
  // ==========================================

  const handleReject = async () => {
    if (!aiSuggestion?.id) return;

    try {
      setActionLoading(true);
      setError("");

      const response = await rejectAiSuggestion(aiSuggestion.id);

      setAiSuggestion((prev) => ({
        ...prev,
        status: "rejected",
        reviewed_by: response?.suggestion?.reviewed_by || "Current User",
        reviewed_at: response?.suggestion?.reviewed_at || new Date().toISOString()
      }));

      setActionSuccess("Suggestion rejected. Checklist remains unchanged.");

      if (typeof onRefresh === "function") {
        onRefresh();
      }
    } catch (err) {
      setAiError(err.message || "Failed to reject suggestion.");
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setActiveModalFile(null);
    setAiSuggestion(null);
    setAiError("");
    setActionSuccess("");
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <section className="staff-file-list-section">
      <div className="staff-file-list-heading">
        <div>
          <h2>Client documents</h2>
          <p>{files.length} document(s) available</p>
        </div>

        <button
          type="button"
          className="staff-refresh-button"
          onClick={() => {
            if (typeof onRefresh === "function") {
              onRefresh();
            }
          }}
          disabled={typeof onRefresh !== "function"}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="staff-file-error" role="alert">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="staff-no-files">
          <div>📁</div>
          <h3>No documents uploaded</h3>
          <p>Uploaded documents will appear here.</p>
        </div>
      ) : (
        <div className="staff-file-table-wrapper">
          <table className="staff-file-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Uploaded by</th>
                <th>Upload date</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {files.map((file) => {
                const fileId = file.id || file._id;
                const isPdf = file.file_type === "PDF";

                return (
                  <tr key={fileId}>
                    <td>
                      <div className="staff-file-name">
                        <span>{isPdf ? "📕" : "🖼️"}</span>
                        <strong>{file.name || "Unnamed document"}</strong>
                      </div>
                    </td>

                    <td>{file.file_type || "Unknown"}</td>

                    <td>{file.uploaded_by?.name || "Unknown"}</td>

                    <td>{formatDate(file.created_at)}</td>

                    <td>{formatSize(file.file_size)}</td>

                    <td>
                      <div className="staff-file-actions">
                        <button
                          type="button"
                          className="staff-file-open-button"
                          onClick={() => handleOpen(file)}
                          disabled={!fileId || openingId === fileId}
                        >
                          {openingId === fileId ? "Opening..." : "Open"}
                        </button>

                        {isPdf && (
                          <button
                            type="button"
                            className="staff-ai-suggest-btn"
                            onClick={() => handleAiSuggest(file)}
                            disabled={suggestingId === fileId}
                            title="Analyze document with Standalone-AI and suggest matching checklist item"
                          >
                            {suggestingId === fileId ? (
                              <>
                                <span className="staff-ai-spinner-inline"></span>
                                <span>Analyzing...</span>
                              </>
                            ) : (
                              <>
                                <span>✨</span>
                                <span>AI Suggest</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ==========================================
          AI SUGGESTION REVIEW MODAL
      ========================================== */}
      {activeModalFile && (
        <div className="staff-ai-modal-backdrop" onClick={closeModal}>
          <div
            className="staff-ai-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-modal-title"
          >
            <header className="staff-ai-modal-header">
              <div className="staff-ai-modal-title-group">
                <span className="staff-ai-sparkle-icon">✨</span>
                <div>
                  <h3 id="ai-modal-title">AI Checklist Suggestion</h3>
                  <p>{activeModalFile.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="staff-ai-close-btn"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="staff-ai-modal-body">
              {/* Loading State */}
              {aiLoading && (
                <div className="staff-ai-loading-box">
                  <div className="staff-ai-big-spinner"></div>
                  <h4>Analyzing Document</h4>
                  <p>
                    Connecting to Standalone-AI microservice and extracting
                    document contents...
                  </p>
                </div>
              )}

              {/* Error / Unavailable State */}
              {!aiLoading && aiError && (
                <div className="staff-ai-error-box" role="alert">
                  <div className="staff-ai-error-icon">⚠️</div>
                  <div className="staff-ai-error-details">
                    <h4>AI Suggestion Unavailable</h4>
                    <p>{aiError}</p>
                    <span className="staff-ai-error-hint">
                      Manual checklist processing remains available. You can
                      update client checklist items directly without interruption.
                    </span>
                  </div>
                </div>
              )}

              {/* Action Success Alert */}
              {actionSuccess && (
                <div className="staff-ai-success-box" role="status">
                  <span>✓</span>
                  <p>{actionSuccess}</p>
                </div>
              )}

              {/* Suggestion Display */}
              {!aiLoading && aiSuggestion && (
                <div className="staff-ai-suggestion-card">
                  <div className="staff-ai-card-top">
                    <div>
                      <span className="staff-ai-label">SUGGESTED CHECKLIST ITEM</span>
                      <h4 className="staff-ai-item-name">
                        {aiSuggestion.checklist_item_name}
                      </h4>
                    </div>

                    <div className="staff-ai-status-badges">
                      <span
                        className={`staff-ai-status-pill status-${aiSuggestion.status}`}
                      >
                        {aiSuggestion.status === "pending" && "⏳ Pending Human Approval"}
                        {aiSuggestion.status === "approved" && "✓ Approved"}
                        {aiSuggestion.status === "rejected" && "✕ Rejected"}
                      </span>

                      <span className="staff-ai-score-pill">
                        {aiSuggestion.score}% Confidence
                      </span>
                    </div>
                  </div>

                  <div className="staff-ai-reason-section">
                    <span className="staff-ai-reason-label">AI Reasoning & Match Evidence</span>
                    <p className="staff-ai-reason-text">{aiSuggestion.reason}</p>
                  </div>

                  {aiSuggestion.reviewed_by && (
                    <div className="staff-ai-review-meta">
                      Reviewed by <strong>{aiSuggestion.reviewed_by}</strong> on{" "}
                      {formatDate(aiSuggestion.reviewed_at)}
                    </div>
                  )}

                  {/* Human Approval Action Buttons */}
                  {aiSuggestion.status === "pending" && (
                    <div className="staff-ai-action-buttons">
                      <button
                        type="button"
                        className="staff-ai-approve-btn"
                        onClick={handleApprove}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Processing..." : "✓ Approve Suggestion"}
                      </button>

                      <button
                        type="button"
                        className="staff-ai-reject-btn"
                        onClick={handleReject}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Processing..." : "✕ Reject Suggestion"}
                      </button>
                    </div>
                  )}

                  <div className="staff-ai-guardrail-notice">
                    <small>
                      🛡️ <strong>Human-in-the-loop:</strong> AI suggestions never
                      automatically complete checklist items. Explicit approval is
                      required.
                    </small>
                  </div>
                </div>
              )}
            </div>

            <footer className="staff-ai-modal-footer">
              <button
                type="button"
                className="staff-ai-dismiss-btn"
                onClick={closeModal}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
