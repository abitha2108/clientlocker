
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import apiRequest from "../../services/api";
import "./PartnerAssignClient.css";

export default function PartnerAssignClient() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [people, setPeople] = useState([]);
  const [auditors, setAuditors] = useState([]);

  const [selectedClient, setSelectedClient] = useState(
    searchParams.get("clientId") || ""
  );

  const [selectedPerson, setSelectedPerson] = useState("");
  const [assignments, setAssignments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ======================================
  // LOAD CLIENTS
  // ======================================

  const loadClients = useCallback(async () => {
    const response = await apiRequest("/api/clients");
    const clientList = response.clients || [];

    setClients(clientList);

    const queryClientId = searchParams.get("clientId");

    if (queryClientId) {
      const exists = clientList.some(
        (client) =>
          String(client.id || client._id) === String(queryClientId)
      );

      setSelectedClient(exists ? queryClientId : "");
    }

    return clientList;
  }, [searchParams]);

  // ======================================
  // LOAD STAFF AND AUDITOR OVERVIEW
  // ======================================

  const loadPeople = useCallback(async () => {
    const response = await apiRequest("/api/staff");

    const staffList = response.staff || [];
    const auditorList = response.auditors || [];

    const peopleList = response.people || [
      ...staffList,
      ...auditorList
    ];

    setPeople(peopleList);
    setAuditors(auditorList);

    return response;
  }, []);

  // ======================================
  // LOAD INITIAL DATA
  // ======================================

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadClients(),
        loadPeople()
      ]);
    } catch (err) {
      setError(
        err.message || "Unable to load assignment information."
      );
    } finally {
      setLoading(false);
    }
  }, [loadClients, loadPeople]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ======================================
  // LOAD ASSIGNMENTS FOR SELECTED CLIENT
  // NEW TASK 7 ENDPOINT
  // GET /api/access/client/:clientId
  // ======================================

  const loadAssignments = useCallback(async () => {
    if (!selectedClient) {
      setAssignments([]);
      return;
    }

    try {
      setAssignmentsLoading(true);

      const response = await apiRequest(
        `/api/access/client/${selectedClient}`
      );

      // Backend returns populated ClientAccess records:
      // {
      //   _id,
      //   person_id: { _id, name, email, role },
      //   created_at
      // }

      const records = response.access || [];

      const formattedAssignments = records
        .filter((record) => record.person_id)
        .map((record) => {
          const person =
            typeof record.person_id === "object"
              ? record.person_id
              : {};

          return {
            assignment_id: record._id,
            id: person._id || record.person_id,
            name: person.name || "Unknown person",
            email: person.email || "",
            role: person.role || "unknown",
            assigned_at: record.created_at || null
          };
        });

      setAssignments(formattedAssignments);

    } catch (err) {
      setAssignments([]);
      setError(
        err.message || "Unable to load assignments."
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // ======================================
  // SELECTED CLIENT
  // ======================================

  const selectedClientData = useMemo(
    () =>
      clients.find(
        (client) =>
          String(client.id || client._id) === String(selectedClient)
      ),
    [clients, selectedClient]
  );

  // ======================================
  // AVAILABLE PEOPLE
  // ======================================

  const assignedPersonIds = useMemo(
    () =>
      new Set(
        assignments.map((person) => String(person.id))
      ),
    [assignments]
  );

  const availablePeople = useMemo(
    () =>
      people.filter(
        (person) =>
          !assignedPersonIds.has(
            String(person.id || person._id)
          ) &&
          ["staff", "auditor"].includes(person.role)
      ),
    [people, assignedPersonIds]
  );

  const selectedPersonData = useMemo(
    () =>
      people.find(
        (person) =>
          String(person.id || person._id) === String(selectedPerson)
      ),
    [people, selectedPerson]
  );

  // ======================================
  // REFRESH AFTER ACCESS CHANGES
  // ======================================

  const refreshAfterChange = async () => {
    await Promise.all([
      loadPeople(),
      loadAssignments()
    ]);
  };

  // ======================================
  // ASSIGN STAFF OR AUDITOR
  // POST /api/access
  // ======================================

  const handleAssign = async (event) => {
    event.preventDefault();

    if (!selectedClient || !selectedPersonData) {
      setError(
        "Please select a client and a staff member or auditor."
      );
      return;
    }

    const personId =
      selectedPersonData.id || selectedPersonData._id;

    const role = selectedPersonData.role;

    if (!["staff", "auditor"].includes(role)) {
      setError("Only staff members and auditors can be assigned.");
      return;
    }

    // Frontend convenience check for auditor capacity.
    // The backend must enforce this rule as well.
    if (role === "auditor") {
      const currentAuditor = auditors.find(
        (auditor) =>
          String(auditor.id || auditor._id) === String(personId)
      );

      const assignedCount = Number(
        currentAuditor?.assigned_count ??
        currentAuditor?.assigned_clients?.length ??
        0
      );

      if (assignedCount >= 2) {
        setError(
          "This auditor already has two assigned clients. Remove an existing assignment first."
        );
        return;
      }
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await apiRequest("/api/access", {
        method: "POST",
        body: JSON.stringify({
          person_id: personId,
          client_id: selectedClient
        })
      });

      setMessage(
        response.message || "Client access granted successfully."
      );

      setSelectedPerson("");

      await refreshAfterChange();

    } catch (err) {
      setError(
        err.message || "Unable to grant client access."
      );

      try {
        await loadPeople();
      } catch {
        // Keep the original error visible.
      }
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // REMOVE STAFF OR AUDITOR ACCESS
  // DELETE /api/access/:id
  // ======================================

  const handleRemove = async (assignment) => {
    const assignmentId = assignment.assignment_id;

    if (!assignmentId) {
      setError("Assignment ID is missing. Cannot remove access.");
      return;
    }

    const personName = assignment.name || "this person";
    const personRole = assignment.role || "staff";

    const confirmed = window.confirm(
      `Remove ${personName} (${personRole}) from ${
        selectedClientData?.name || "this client"
      }?`
    );

    if (!confirmed) return;

    try {
      setRemovingId(assignmentId);
      setError("");
      setMessage("");

      const response = await apiRequest(
        `/api/access/${assignmentId}`,
        {
          method: "DELETE"
        }
      );

      setMessage(
        response.message ||
        `${personName}'s access removed successfully.`
      );

      setSelectedPerson("");

      await refreshAfterChange();

    } catch (err) {
      setError(
        err.message || "Unable to remove client access."
      );
    } finally {
      setRemovingId("");
    }
  };

  // ======================================
  // AUDITOR OVERVIEW HELPERS
  // ======================================

  const getAuditorCount = (auditor) => {
    return Number(
      auditor.assigned_count ??
      auditor.assigned_clients?.length ??
      0
    );
  };

  const getAuditorClients = (auditor) => {
    return auditor.assigned_clients || [];
  };

  const openAuditorClient = (clientId) => {
    navigate(
      `/partner/assignments?clientId=${clientId}`
    );
  };

  // ======================================
  // CURRENT CLIENT COUNTS
  // ======================================

  const staffCount = assignments.filter(
    (person) => person.role === "staff"
  ).length;

  const auditorCount = assignments.filter(
    (person) => person.role === "auditor"
  ).length;

  // ======================================
  // RENDER
  // ======================================

  return (
    <motion.main
      className="partner-assign-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >

      {/* HEADER */}

      <header className="pa-header">
        <div>
          <span>PARTNER WORKSPACE</span>
          <h1>Client Access Management</h1>
          <p>
            Manage staff and auditor permissions for your clients.
          </p>
        </div>

        <button
          type="button"
          className="pa-back-button"
          onClick={() => navigate("/partner/dashboard")}
        >
          ← Dashboard
        </button>
      </header>

      {/* ALERTS */}

      {error && (
        <div className="pa-alert error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {message && (
        <div className="pa-alert success" role="status">
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="pa-loading">
          Loading clients, staff and auditors...
        </div>
      ) : (
        <>

          {/* CLIENT SELECTION */}

          <section className="pa-panel">
            <div className="pa-panel-heading">
              <div>
                <h2>Select a client</h2>
                <p>
                  Choose the client whose access permissions
                  you want to manage.
                </p>
              </div>
            </div>

            <label htmlFor="pa-client">Client</label>

            <select
              id="pa-client"
              value={selectedClient}
              onChange={(event) => {
                setSelectedClient(event.target.value);
                setSelectedPerson("");
                setMessage("");
                setError("");
              }}
            >
              <option value="">Select a client</option>

              {clients.map((client) => {
                const id = client.id || client._id;

                return (
                  <option key={id} value={id}>
                    {client.name}
                  </option>
                );
              })}
            </select>

            {clients.length === 0 && (
              <p className="pa-help">
                No clients available. Create a client first.
              </p>
            )}

            {selectedClientData && (
              <div className="pa-selected-client">
                <div className="pa-client-avatar">
                  {selectedClientData.name
                    ?.charAt(0)
                    .toUpperCase() || "C"}
                </div>

                <div>
                  <strong>{selectedClientData.name}</strong>
                  <span>Selected client</span>
                </div>
              </div>
            )}
          </section>

          {/* AUDITOR ASSIGNMENT OVERVIEW */}

          <section className="pa-panel pa-auditor-overview">
            <div className="pa-panel-heading">
              <div>
                <h2>Auditor Assignment Overview</h2>
                <p>
                  Monitor each auditor's assigned clients
                  and available assignment capacity.
                </p>
              </div>

              <span className="pa-count">
                {auditors.length} auditors
              </span>
            </div>

            {auditors.length === 0 ? (
              <div className="pa-empty">
                <div>🛡️</div>
                <h3>No active auditors found</h3>
                <p>
                  Active auditor accounts will appear here.
                </p>
              </div>
            ) : (
              <div className="pa-auditor-grid">
                {auditors.map((auditor) => {
                  const assignedClients =
                    getAuditorClients(auditor);

                  const assignedCount =
                    getAuditorCount(auditor);

                  const isFull = assignedCount >= 2;

                  const progress = Math.min(
                    (assignedCount / 2) * 100,
                    100
                  );

                  return (
                    <article
                      className="pa-auditor-card"
                      key={auditor.id || auditor._id}
                    >
                      <div className="pa-auditor-card-header">
                        <div className="pa-auditor-profile">
                          <div className="pa-auditor-avatar">
                            {auditor.name
                              ?.charAt(0)
                              .toUpperCase() || "A"}
                          </div>

                          <div>
                            <h3>{auditor.name}</h3>
                            <p>{auditor.email}</p>
                          </div>
                        </div>

                        <span className="pa-auditor-role">
                          AUDITOR
                        </span>
                      </div>

                      <div className="pa-auditor-capacity">
                        <div className="pa-capacity-label">
                          <span>Client assignments</span>
                          <strong>{assignedCount} / 2</strong>
                        </div>

                        <div className="pa-capacity-track">
                          <div
                            className={`pa-capacity-fill ${
                              isFull ? "full" : ""
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <span className="pa-capacity-status">
                          {isFull
                            ? "Maximum assignments reached"
                            : `${2 - assignedCount} assignment slot(s) available`}
                        </span>
                      </div>

                      <div className="pa-auditor-clients">
                        <strong>Assigned clients</strong>

                        {assignedClients.length === 0 ? (
                          <p className="pa-no-auditor-clients">
                            No clients assigned yet.
                          </p>
                        ) : (
                          <ul>
                            {assignedClients.map((client) => (
                              <li key={client.id}>
                                <span className="pa-client-dot" />

                                <span className="pa-auditor-client-name">
                                  {client.name}
                                </span>

                                <button
                                  type="button"
                                  className="pa-client-manage-link"
                                  onClick={() =>
                                    openAuditorClient(client.id)
                                  }
                                >
                                  Manage
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="pa-auditor-card-footer">
                        <span>
                          {isFull
                            ? "Fully assigned"
                            : "Assignment available"}
                        </span>

                        {assignedClients.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              openAuditorClient(
                                assignedClients[0].id
                              )
                            }
                          >
                            Manage access →
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ASSIGN STAFF OR AUDITOR */}

          <section className="pa-panel">
            <div className="pa-panel-heading">
              <div>
                <h2>Assign access</h2>
                <p>
                  Give an active staff member or auditor
                  access to the selected client.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAssign}
              className="pa-assign-form"
            >
              <div>
                <label htmlFor="pa-person">
                  Staff member / Auditor
                </label>

                <select
                  id="pa-person"
                  value={selectedPerson}
                  onChange={(event) =>
                    setSelectedPerson(event.target.value)
                  }
                  disabled={
                    !selectedClient ||
                    availablePeople.length === 0
                  }
                >
                  <option value="">Select a person</option>

                  {availablePeople.map((person) => {
                    const id = person.id || person._id;

                    const auditorData =
                      person.role === "auditor"
                        ? auditors.find(
                            (auditor) =>
                              String(auditor.id || auditor._id) ===
                              String(id)
                          )
                        : null;

                    const count = auditorData
                      ? getAuditorCount(auditorData)
                      : 0;

                    const capacityLabel =
                      person.role === "auditor"
                        ? ` — ${count}/2 clients`
                        : "";

                    return (
                      <option
                        key={id}
                        value={id}
                        disabled={
                          person.role === "auditor" &&
                          count >= 2
                        }
                      >
                        {person.name} — {person.role?.toUpperCase()}
                        {capacityLabel} — {person.email}
                      </option>
                    );
                  })}
                </select>

                {selectedPersonData && (
                  <p className="pa-help">
                    Selected role:{" "}
                    <strong>
                      {selectedPersonData.role?.toUpperCase()}
                    </strong>

                    {selectedPersonData.role === "auditor" && (
                      <>
                        {" "}· Auditors can be assigned to a
                        maximum of two clients.
                      </>
                    )}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedClient ||
                  !selectedPerson
                }
              >
                {saving ? "Assigning..." : "+ Assign access"}
              </button>
            </form>

            {selectedClient && availablePeople.length === 0 && (
              <p className="pa-help">
                All available staff members and auditors are
                already assigned to this client, or no active
                people are available.
              </p>
            )}
          </section>

          {/* CURRENT CLIENT COUNTS */}

          <section className="pa-summary-grid">
            <article className="pa-summary-card">
              <span>Assigned staff</span>
              <strong>{staffCount}</strong>
            </article>

            <article className="pa-summary-card">
              <span>Assigned auditors</span>
              <strong>{auditorCount}</strong>
            </article>

            <article className="pa-summary-card">
              <span>Total assignments</span>
              <strong>{assignments.length}</strong>
            </article>
          </section>

          {/* ASSIGNED PEOPLE TABLE */}

          <section className="pa-panel pa-assignment-panel">
            <div className="pa-panel-heading pa-assignment-heading">
              <div>
                <h2>Assigned people</h2>

                <p>
                  {selectedClientData
                    ? `People with access to ${selectedClientData.name}.`
                    : "Select a client to see its assignments."}
                </p>
              </div>

              <span className="pa-count">
                {assignments.length} assigned
              </span>
            </div>

            {!selectedClient ? (
              <div className="pa-empty">
                Select a client to view assignments.
              </div>
            ) : assignmentsLoading ? (
              <div className="pa-empty">
                Loading assignments...
              </div>
            ) : assignments.length === 0 ? (
              <div className="pa-empty">
                <div>♙</div>
                <h3>No assignments yet</h3>
                <p>
                  Assign a staff member or auditor using
                  the form above.
                </p>
              </div>
            ) : (
              <div className="pa-table-wrapper">
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Assigned date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignments.map((person) => (
                      <tr key={person.assignment_id}>
                        <td>
                          <div className="pa-staff-cell">
                            <div className="pa-staff-avatar">
                              {person.name
                                ?.charAt(0)
                                .toUpperCase() || "U"}
                            </div>

                            <strong>{person.name}</strong>
                          </div>
                        </td>

                        <td>{person.email || "—"}</td>

                        <td>
                          <span
                            className={`pa-role-badge ${
                              person.role === "auditor"
                                ? "pa-role-auditor"
                                : "pa-role-staff"
                            }`}
                          >
                            {person.role?.toUpperCase() || "UNKNOWN"}
                          </span>
                        </td>

                        <td>
                          {person.assigned_at
                            ? new Date(
                                person.assigned_at
                              ).toLocaleDateString("en-IN")
                            : "—"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="pa-remove-button"
                            disabled={
                              removingId === person.assignment_id
                            }
                            onClick={() =>
                              handleRemove(person)
                            }
                          >
                            {removingId === person.assignment_id
                              ? "Removing..."
                              : "Remove access"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* AUDITOR POLICY */}

          <section className="pa-auditor-notice">
            <div className="pa-auditor-notice-icon">
              🛡️
            </div>

            <div>
              <strong>Auditor access policy</strong>

              <p>
                Each auditor is assigned a maximum of two clients.
                Auditors can view and open files for their assigned
                clients but cannot upload or delete files.
                Access is checked by the backend on every request.
              </p>
            </div>
          </section>

        </>
      )}
    </motion.main>
  );
}
