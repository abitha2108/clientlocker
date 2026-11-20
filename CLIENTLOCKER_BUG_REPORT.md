# ClientLocker — Production Defect & Bug Audit Report

**Report Date:** November 20, 2026  
**QA Lead:** Senior QA Automation & Full-Stack Security Auditor  
**Application:** ClientLocker (Web & API)

---

## 1. Summary Defect Registry

| Bug ID | Title | Severity | Component | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Missing Auditor Routes in Frontend React Router | High | Frontend (`App.jsx`) | **FIXED LOCALLY** |
| **BUG-02** | Missing Partner Activity & Assignment Routes | Medium | Frontend (`App.jsx`) | **FIXED LOCALLY** |
| **BUG-03** | Standalone-AI API Key Mismatch on Render | High | Backend Config (Render) | **RESOLVED LIVE** |
| **BUG-04** | Malformed JWT SyntaxError Returns HTTP 500 | Low | Backend (`authMiddleware.js`) | **FIX AVAILABLE** |

---

## 2. Detailed Bug Reports

### BUG-01: Missing Auditor Routes in Frontend React Router
- **Severity:** High
- **Component:** Frontend Router ([App.jsx](file:///c:/Project/INTERNSHIP/Abitha/frontend/src/App.jsx))
- **Description:** Authenticated auditors logging in with valid credentials (`senthil.auditor@clientlocker.test`) were redirected to `/` because the route `/auditor/dashboard` was not registered in `<Routes>`.
- **Steps to Reproduce:**
  1. Navigate to `https://clientlocker-theta.vercel.app/login`.
  2. Enter valid auditor credentials.
  3. Click "Sign in".
- **Expected Result:** Redirect to `/auditor/dashboard` and render `AuditorDashboard.jsx`.
- **Actual Result:** Hit the wildcard fallback `<Route path="*" element={<Navigate to="/" replace />} />`.
- **Root Cause:** Route was omitted during the milestone 2 router lockdown.
- **Fix Applied:** Registered `<Route path="/auditor/dashboard">` and `<Route path="/auditor/clients/:clientId">` in `frontend/src/App.jsx` with `RoleProtectedRoute allowedRoles={["auditor"]}`.
- **Fix Status:** **Verified locally, build passing in 2.89s (0 errors)**. Ready for Vercel redeployment.

---

### BUG-02: Missing Partner Activity & Assignment Routes
- **Severity:** Medium
- **Component:** Frontend Navigation ([App.jsx](file:///c:/Project/INTERNSHIP/Abitha/frontend/src/App.jsx), [PartnerDashboard.jsx](file:///c:/Project/INTERNSHIP/Abitha/frontend/src/pages/partner/PartnerDashboard.jsx))
- **Description:** On the Partner Dashboard, clicking "Activity Log" or "Access Management" links navigated to `/partner/activity` and `/partner/assignments`, causing unexpected redirects to `/`.
- **Steps to Reproduce:**
  1. Log in as partner (`kavitha.partner@clientlocker.test`).
  2. Click "Activity Log" in sidebar.
- **Expected Result:** Load the full firm audit log page.
- **Actual Result:** Bounced back to `/`.
- **Root Cause:** Routes `/partner/activity` and `/partner/assignments` were not mapped in `App.jsx`.
- **Fix Applied:** Registered both routes to `<ActivityLog />` and `<PartnerAssignClient />` in `App.jsx`.
- **Fix Status:** **Verified locally**. Ready for Vercel redeployment.

---

### BUG-03: Standalone-AI API Key Mismatch on Render
- **Severity:** High
- **Component:** Production Environment Configuration (Render)
- **Description:** When staff clicked "✨ AI Suggest", the microservice returned `HTTP 401 {"detail":"Invalid API key."}`.
- **Steps to Reproduce:**
  1. Log in as staff on production.
  2. Open an assigned client document and trigger "AI Suggest".
- **Expected Result:** Standalone-AI authenticates key and returns checklist suggestion.
- **Actual Result:** Upstream HTTP 401 returned, triggering graceful degradation notice.
- **Root Cause:** `AI_SERVICE_API_KEY` configured in the ClientLocker Render backend did not match the key on the Standalone-AI Render service.
- **Fix Applied:** Synchronized `AI_SERVICE_API_KEY` across both Render web services. Enhanced `aiService.js` to strip surrounding quotes and send dual `X-API-Key` and `Authorization: Bearer` headers.
- **Fix Status:** **Verified Live (HTTP 201 Created observed in live production tests)**.

---

### BUG-04: Malformed JWT SyntaxError Returns HTTP 500
- **Severity:** Low
- **Component:** Backend Authentication Middleware ([authMiddleware.js](file:///c:/Project/INTERNSHIP/Abitha/backend/middleware/authMiddleware.js))
- **Description:** Sending a malformed base64 JWT payload (e.g. `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.badtoken.xyz`) returns `HTTP 500 Internal Server Error` instead of `HTTP 401 Unauthorized`.
- **Steps to Reproduce:**
  1. Send `GET /api/auth/me` with header `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.badtoken.xyz`.
- **Expected Result:** `HTTP 401 Unauthorized {"success":false,"message":"Invalid or expired authentication token."}`.
- **Actual Result:** `HTTP 500 Internal Server Error {"success":false,"message":"Authentication verification failed."}`.
- **Root Cause:** `jsonwebtoken` base64-decodes the payload and calls `JSON.parse`. When binary junk is parsed, it throws a native `SyntaxError` (not a `JsonWebTokenError`). The catch block only checked for JWT error classes.
- **Remediation:** Update the catch block in `authMiddleware.js` to catch `SyntaxError` alongside `JsonWebTokenError` and return HTTP 401.
- **Fix Status:** Identified, safe local fix documented.
