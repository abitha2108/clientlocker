const request = require("supertest");
const mongoose = require("mongoose");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-key-minimum-32-chars-long";

const app = require("../server");
const { generateToken } = require("../utils/jwt");

const Person = require("../models/Person");
const Client = require("../models/Client");
const ClientAccess = require("../models/ClientAccess");
const StoredFile = require("../models/File");
const ChecklistItem = require("../models/ChecklistItem");
const ActivityLog = require("../models/ActivityLog");

describe("Access Revocation, Blocked Attempt Logging & Recovery Security Suite", () => {
  const firmId = new mongoose.Types.ObjectId();
  const partnerId = new mongoose.Types.ObjectId();
  const staffId = new mongoose.Types.ObjectId();
  const clientUserId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const otherClientId = new mongoose.Types.ObjectId();
  const accessId = new mongoose.Types.ObjectId();
  const fileId = new mongoose.Types.ObjectId();

  let partnerToken;
  let staffToken;
  let clientToken;
  let hasAssignment;
  let activityLogs;

  beforeEach(() => {
    jest.restoreAllMocks();
    hasAssignment = true;
    activityLogs = [];

    partnerToken = generateToken({
      _id: partnerId,
      firm_id: firmId,
      role: "partner"
    });

    staffToken = generateToken({
      _id: staffId,
      firm_id: firmId,
      role: "staff"
    });

    clientToken = generateToken({
      _id: clientUserId,
      firm_id: firmId,
      role: "client"
    });

    jest.spyOn(Person, "findOne").mockImplementation((query) => {
      const id = String(query?._id || "");
      const doc =
        id === String(partnerId)
          ? {
              _id: partnerId,
              firm_id: firmId,
              name: "Partner User",
              email: "partner@test.local",
              role: "partner",
              is_active: true
            }
          : id === String(staffId)
            ? {
                _id: staffId,
                firm_id: firmId,
                name: "Trainee User",
                email: "trainee@test.local",
                role: "staff",
                is_active: true
              }
            : id === String(clientUserId)
              ? {
                  _id: clientUserId,
                  firm_id: firmId,
                  name: "Client User",
                  email: "client@test.local",
                  role: "client",
                  client_id: otherClientId,
                  is_active: true
                }
              : null;

      return {
        select: jest.fn().mockResolvedValue(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
      };
    });

    jest.spyOn(Client, "findOne").mockImplementation((query) => {
      const id = String(query?._id || "");
      const doc =
        id === String(clientId)
          ? { _id: clientId, firm_id: firmId, name: "Chola Packaging" }
          : id === String(otherClientId)
            ? { _id: otherClientId, firm_id: firmId, name: "Other Client" }
            : null;

      return {
        select: jest.fn().mockResolvedValue(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
      };
    });

    jest.spyOn(ClientAccess, "findById").mockImplementation((id) => {
      if (!hasAssignment || String(id) !== String(accessId)) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        _id: accessId,
        person_id: staffId,
        client_id: clientId,
        given_by: partnerId
      });
    });

    jest.spyOn(ClientAccess, "deleteOne").mockImplementation(() => {
      if (!hasAssignment) {
        return Promise.resolve({ deletedCount: 0 });
      }
      hasAssignment = false;
      return Promise.resolve({ deletedCount: 1 });
    });

    jest.spyOn(ClientAccess, "findOne").mockImplementation((query) => {
      if (
        hasAssignment &&
        String(query?.person_id) === String(staffId) &&
        String(query?.client_id) === String(clientId)
      ) {
        return Promise.resolve({
          _id: accessId,
          person_id: staffId,
          client_id: clientId,
          given_by: partnerId
        });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(ClientAccess, "exists").mockImplementation((query) => {
      if (
        hasAssignment &&
        String(query?.person_id) === String(staffId) &&
        String(query?.client_id) === String(clientId)
      ) {
        return Promise.resolve({ _id: accessId });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(ClientAccess, "create").mockImplementation((payload) => {
      hasAssignment = true;
      return Promise.resolve({
        _id: accessId,
        ...payload,
        created_at: new Date()
      });
    });

    jest.spyOn(StoredFile, "find").mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: fileId,
          client_id: clientId,
          name: "statement.pdf",
          file_type: "PDF",
          file_size: 1024,
          uploaded_by: { _id: partnerId, name: "Partner User", email: "partner@test.local" },
          checklist_item_id: null,
          created_at: new Date()
        }
      ])
    }));

    jest.spyOn(StoredFile, "findById").mockResolvedValue({
      _id: fileId,
      client_id: clientId,
      name: "statement.pdf",
      file_type: "PDF"
    });

    jest.spyOn(ChecklistItem, "find").mockImplementation(() => ({
      sort: jest.fn().mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(), client_id: clientId, name: "March bank statement", done: false }
      ])
    }));

    jest.spyOn(ActivityLog, "create").mockImplementation((entry) => {
      const saved = { ...entry, _id: new mongoose.Types.ObjectId(), created_at: new Date() };
      activityLogs.push(saved);
      return Promise.resolve(saved);
    });
  });

  test("revokes access, blocks & logs unauthorized attempts, and restores access", async () => {
    // 1. Before removal: staff can list files & checklist
    const beforeFiles = await request(app)
      .get(`/api/clients/${clientId}/files`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(beforeFiles.status).toBe(200);
    expect(beforeFiles.body.count).toBe(1);

    // 2. Partner removes access
    const removeRes = await request(app)
      .delete(`/api/access/${accessId}`)
      .set("Authorization", `Bearer ${partnerToken}`);
    expect(removeRes.status).toBe(200);
    expect(activityLogs.some((l) => l.action === "ACCESS_REMOVED" && l.blocked === false)).toBe(true);

    // 3. Stale staff token is immediately blocked on files, checklist, and download link
    const blockedFiles = await request(app)
      .get(`/api/clients/${clientId}/files`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(blockedFiles.status).toBe(403);

    const blockedChecklist = await request(app)
      .get(`/api/clients/${clientId}/checklist`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(blockedChecklist.status).toBe(403);

    const blockedLink = await request(app)
      .post(`/api/files/${fileId}/link`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(blockedLink.status).toBe(403);

    const blockedEntries = activityLogs.filter((l) => l.blocked === true);
    expect(blockedEntries.length).toBe(3);
    expect(blockedEntries.filter((l) => l.action === "ACCESS_BLOCKED").length).toBe(2);
    expect(blockedEntries.filter((l) => l.action === "FILE_DOWNLOAD_BLOCKED").length).toBe(1);

    // 4. Client cannot access another client's files
    const clientBlocked = await request(app)
      .get(`/api/clients/${clientId}/files`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(clientBlocked.status).toBe(403);

    // 5. Partner restores access & historical blocked logs remain intact
    const restoreRes = await request(app)
      .post("/api/access")
      .set("Authorization", `Bearer ${partnerToken}`)
      .send({ person_id: staffId.toString(), client_id: clientId.toString() });
    expect(restoreRes.status).toBe(201);
    expect(activityLogs.some((l) => l.action === "ACCESS_GRANTED" && l.blocked === false)).toBe(true);
    expect(activityLogs.filter((l) => l.blocked === true).length).toBe(4);

    // 6. Staff regains access without re-logging in
    const afterFiles = await request(app)
      .get(`/api/clients/${clientId}/files`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(afterFiles.status).toBe(200);

    const afterChecklist = await request(app)
      .get(`/api/clients/${clientId}/checklist`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(afterChecklist.status).toBe(200);
  });
});
