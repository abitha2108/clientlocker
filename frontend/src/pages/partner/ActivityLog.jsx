
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  FileText,
  UserPlus,
  UserMinus,
  ShieldAlert,
  AlertCircle,
  Clock
} from "lucide-react";

import apiRequest from "../../services/api";
import "./ActivityLog.css";

export default function ActivityLog() {
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // LOAD ACTIVITY LOGS
  // ==========================================

  const loadActivities = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiRequest("/api/activity");

      const records = Array.isArray(response?.activity)
        ? response.activity
        : Array.isArray(response?.logs)
          ? response.logs
          : [];

      const sortedRecords = [...records].sort((a, b) => {
        const dateA = new Date(a?.created_at || 0).getTime();
        const dateB = new Date(b?.created_at || 0).getTime();

        return dateB - dateA;
      });

      setActivities(sortedRecords);
    } catch (err) {
      setError(err.message || "Unable to load activity history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // ==========================================
  // ACTIVITY DISPLAY HELPERS
  // ==========================================

  const getActionDetails = (action) => {
    const actions = {
      FILE_UPLOADED: {
        label: "File uploaded",
        icon: FileText,
        className: "al-upload"
      },

      FILE_OPENED: {
        label: "File opened / downloaded",
        icon: FileText,
        className: "al-open"
      },

      ACCESS_GRANTED: {
        label: "Client access granted",
        icon: UserPlus,
        className: "al-granted"
      },

      ACCESS_REMOVED: {
        label: "Client access removed",
        icon: UserMinus,
        className: "al-removed"
      },

      ACCESS_BLOCKED: {
        label: "Access blocked",
        icon: ShieldAlert,
        className: "al-blocked"
      },

      FILE_DOWNLOAD_BLOCKED: {
        label: "File download blocked",
        icon: ShieldAlert,
        className: "al-blocked"
      }
    };

    return actions[action] || {
      label: action || "Unknown activity",
      icon: Activity,
      className: "al-default"
    };
  };

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getPersonName = (person) => {
    if (!person) return "Unknown user";

    if (typeof person === "string") {
      return "User record";
    }

    return person.name || person.email || "Unknown user";
  };

  const getPersonEmail = (person) => {
    if (!person || typeof person === "string") {
      return "";
    }

    return person.email || "";
  };

  const getFileName = (file) => {
    if (!file) return "No file associated";

    if (typeof file === "string") {
      return "File record";
    }

    return file.name || "Unnamed file";
  };

  const getClientName = (client) => {
    if (!client) return "No client associated";

    if (typeof client === "string") {
      return "Client record";
    }

    return client.name || "Unnamed client";
  };

  // ==========================================
  // SUMMARY COUNTS
  // ==========================================

  const summary = useMemo(() => {
    return {
      blocked: activities.filter(
        (item) =>
          item.blocked === true ||
          item.action === "ACCESS_BLOCKED" ||
          item.action === "FILE_DOWNLOAD_BLOCKED"
      ).length,

      uploads: activities.filter(
        (item) => item.action === "FILE_UPLOADED"
      ).length,

      accessChanges: activities.filter(
        (item) =>
          item.action === "ACCESS_GRANTED" ||
          item.action === "ACCESS_REMOVED"
      ).length
    };
  }, [activities]);

  // ==========================================
  // PAGE UI
  // ==========================================

  return (
    <motion.main
      className="activity-log-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >

      <header className="al-header">
        <div className="al-header-title">
          <div className="al-header-icon">
            <ShieldCheck size={25} />
          </div>

          <div>
            <span className="al-eyebrow">
              CLIENTLOCKER / PARTNER
            </span>

            <h1>Activity Log</h1>

            <p>
              Monitor activity and security events across your firm.
            </p>
          </div>
        </div>

        <div className="al-header-actions">
          <button
            type="button"
            className="al-refresh-button"
            onClick={() => loadActivities(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={17}
              className={refreshing ? "al-spinning" : ""}
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="al-back-button"
            onClick={() => navigate("/partner/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
        </div>
      </header>

      <section className="al-security-notice">
        <ShieldCheck size={23} />

        <div>
          <strong>Read-only activity history</strong>

          <p>
            Activity records are provided for monitoring and auditing.
            They cannot be edited or deleted from this page.
          </p>
        </div>
      </section>

      {error && (
        <div className="al-alert" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadActivities()}
          >
            Retry
          </button>
        </div>
      )}

      <section className="al-summary-grid">
        <article className="al-summary-card">
          <div className="al-summary-icon blue">
            <Activity size={23} />
          </div>

          <div>
            <span>Total activities</span>
            <strong>{loading ? "—" : activities.length}</strong>
          </div>
        </article>

        <article className="al-summary-card">
          <div className="al-summary-icon green">
            <FileText size={23} />
          </div>

          <div>
            <span>Files uploaded</span>
            <strong>{loading ? "—" : summary.uploads}</strong>
          </div>
        </article>

        <article className="al-summary-card">
          <div className="al-summary-icon purple">
            <UserPlus size={23} />
          </div>

          <div>
            <span>Access changes</span>
            <strong>{loading ? "—" : summary.accessChanges}</strong>
          </div>
        </article>

        <article className="al-summary-card">
          <div className="al-summary-icon red">
            <ShieldAlert size={23} />
          </div>

          <div>
            <span>Blocked activities</span>
            <strong>{loading ? "—" : summary.blocked}</strong>
          </div>
        </article>
      </section>

      <section className="al-table-panel">
        <div className="al-table-heading">
          <div>
            <h2>Recent activity</h2>
            <p>
              Security and document activity, newest first.
            </p>
          </div>

          <span className="al-record-count">
            {activities.length} records
          </span>
        </div>

        {loading ? (
          <div className="al-empty">
            <RefreshCw size={30} className="al-spinning" />
            <p>Loading activity history...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="al-empty">
            <Activity size={42} />

            <h3>No activity recorded yet</h3>

            <p>
              Uploads, file downloads and access changes
              will appear here.
            </p>
          </div>
        ) : (
          <div className="al-table-wrapper">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>User</th>
                  <th>Client</th>
                  <th>File</th>
                  <th>Result</th>
                  <th>Date and time</th>
                </tr>
              </thead>

              <tbody>
                {activities.map((item, index) => {
                  const details = getActionDetails(item.action);
                  const ActionIcon = details.icon;

                  const isBlocked =
                    item.blocked === true ||
                    item.action === "ACCESS_BLOCKED" ||
                    item.action === "FILE_DOWNLOAD_BLOCKED";

                  const personEmail = getPersonEmail(item.person_id);

                  return (
                    <tr key={item._id || `${item.action}-${index}`}>
                      <td>
                        <div className="al-action-cell">
                          <div className={`al-action-icon ${details.className}`}>
                            <ActionIcon size={19} />
                          </div>

                          <div>
                            <strong>{details.label}</strong>
                            <small>{item.action || "Unknown action"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="al-user-cell">
                          <strong>
                            {getPersonName(item.person_id)}
                          </strong>

                          {personEmail && (
                            <small>{personEmail}</small>
                          )}
                        </div>
                      </td>

                      <td>
                        {getClientName(item.client_id)}
                      </td>

                      <td>
                        {getFileName(item.file_id)}
                      </td>

                      <td>
                        <span
                          className={`al-result ${
                            isBlocked
                              ? "al-result-blocked"
                              : "al-result-success"
                          }`}
                        >
                          {isBlocked ? "Blocked" : "Allowed"}
                        </span>
                      </td>

                      <td>
                        <div className="al-date-cell">
                          <Clock size={15} />
                          {formatDate(item.created_at)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="al-footer">
        <ShieldCheck size={17} />
        ClientLocker · Secure and read-only activity monitoring.
      </footer>
    </motion.main>
  );
}
