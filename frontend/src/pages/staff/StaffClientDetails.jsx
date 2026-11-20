
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import apiRequest, {
  getClientFiles,
  getClientChecklist,
  updateChecklistItem
} from "../../services/api";

import StaffFileUpload from "./StaffFileUpload";
import FileList from "../../components/FileList";

import "./StaffClientDetails.css";

export default function StaffClientDetails() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [files, setFiles] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchClientData = useCallback(async () => {
    if (!clientId) {
      setClient(null);
      setFiles([]);
      setChecklist([]);
      setError("Client ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setClient(null);
      setFiles([]);

      // Fetch clients available to the logged-in staff member.
      const clientResponse = await apiRequest("/api/clients");

      const clients = Array.isArray(clientResponse.clients)
        ? clientResponse.clients
        : [];

      const selectedClient = clients.find(
        (item) => String(item.id || item._id) === String(clientId)
      );

      if (!selectedClient) {
        throw new Error(
          "Client not found or you do not have access to this client."
        );
      }

      setClient(selectedClient);

      // Fetch files for this client.
      const fileResponse = await getClientFiles(clientId);

      if (!Array.isArray(fileResponse.files)) {
        throw new Error("Unable to read the client's document list.");
      }

      setFiles(fileResponse.files);

      // Fetch checklist for this client.
      try {
        const checklistResponse = await getClientChecklist(clientId);
        const items = Array.isArray(checklistResponse?.items)
          ? checklistResponse.items
          : Array.isArray(checklistResponse)
            ? checklistResponse
            : [];
        setChecklist(items);
      } catch (chkErr) {
        console.warn("Could not load checklist items:", chkErr.message);
      }

    } catch (err) {
      setClient(null);
      setFiles([]);
      setChecklist([]);
      setError(err.message || "Unable to load client information.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Manual checklist toggle
  const handleToggleChecklist = async (item) => {
    const itemId = item._id || item.id;
    if (!itemId || updatingItemId) return;

    try {
      setUpdatingItemId(itemId);
      const newStatus = !item.done;
      await updateChecklistItem(itemId, newStatus);

      setChecklist((prev) =>
        prev.map((i) =>
          String(i._id || i.id) === String(itemId)
            ? { ...i, done: newStatus }
            : i
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update checklist item status.");
    } finally {
      setUpdatingItemId(null);
    }
  };

  const completedCount = checklist.filter((i) => i.done).length;
  const totalChecklist = checklist.length;
  const progressPercent = totalChecklist > 0 ? Math.round((completedCount / totalChecklist) * 100) : 0;

  if (loading) {
    return (
      <main className="staff-client-details">
        <div className="staff-details-loading">
          Loading client information...
        </div>
      </main>
    );
  }

  if (error && !client) {
    return (
      <main className="staff-client-details">
        <button
          type="button"
          className="staff-back-button"
          onClick={() => navigate("/staff")}
        >
          ← Back to clients
        </button>

        <div className="staff-details-error">
          {error}
        </div>

        <button
          type="button"
          className="staff-back-button"
          onClick={fetchClientData}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <motion.main
      className="staff-client-details"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        className="staff-back-button"
        onClick={() => navigate("/staff")}
      >
        ← Back to clients
      </button>

      <header className="staff-client-details-header">
        <div className="staff-client-details-avatar">
          {(client?.name || "C").charAt(0).toUpperCase()}
        </div>

        <div>
          <span>CLIENT WORKSPACE</span>
          <h1>{client?.name}</h1>
          <p>Manage and securely access client documents and AI-assisted checklists.</p>
        </div>
      </header>

      {error && (
        <div className="staff-details-error">
          {error}
        </div>
      )}

      <div className="staff-details-stats">
        <div>
          <span>Documents</span>
          <strong>{files.length}</strong>
        </div>

        <div>
          <span>Checklist Progress</span>
          <strong>{completedCount} / {totalChecklist} ({progressPercent}%)</strong>
        </div>

        <div>
          <span>Client status</span>
          <strong className="staff-assigned-label">
            Assigned
          </strong>
        </div>
      </div>

      <div className="staff-client-details-layout">
        <div className="staff-details-upload-column">
          <StaffFileUpload
            clientId={clientId}
            onUploadSuccess={fetchClientData}
          />

          {/* Client Checklist Section */}
          <div className="staff-checklist-card">
            <div className="staff-checklist-card-header">
              <div>
                <h3>Document Checklist</h3>
                <p>AI suggestions link documents to these items</p>
              </div>
              <span className="staff-checklist-badge">
                {progressPercent}% Done
              </span>
            </div>

            <div className="staff-progress-bar-track">
              <div
                className="staff-progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="staff-checklist-items-list">
              {checklist.length === 0 ? (
                <p className="staff-checklist-empty">No checklist items defined.</p>
              ) : (
                checklist.map((item) => {
                  const itemId = item._id || item.id;
                  const isUpdating = updatingItemId === itemId;

                  return (
                    <div
                      key={itemId}
                      className={`staff-checklist-item-row ${item.done ? "is-done" : ""}`}
                    >
                      <label className="staff-checklist-checkbox-label">
                        <input
                          type="checkbox"
                          checked={Boolean(item.done)}
                          disabled={isUpdating}
                          onChange={() => handleToggleChecklist(item)}
                        />
                        <span className="staff-checklist-item-name">
                          {item.name}
                        </span>
                      </label>

                      <span
                        className={`staff-item-status-pill ${
                          item.done ? "pill-done" : "pill-pending"
                        }`}
                      >
                        {item.done ? "Completed" : "Open"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="staff-details-files-column">
          <FileList
            clientId={clientId}
            files={files}
            onRefresh={fetchClientData}
          />
        </div>
      </div>
    </motion.main>
  );
}
