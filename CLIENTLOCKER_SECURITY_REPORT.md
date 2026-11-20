# ClientLocker — Defensive Application Security Audit Report

**Audit Date:** November 20, 2026  
**Auditor Role:** Senior Application Security & Penetration Testing Specialist  
**Target Environment:** Production (`https://clientlocker-qfz5.onrender.com`, `https://clientlocker-theta.vercel.app/`)  
**Scope:** Full-Stack API, Authentication, Authorization Middleware, RBAC, File Storage, AI Microservice Bridge, Audit Trail

---

## 1. Executive Security Summary

| Category | Finding / Posture | Severity | Status |
| :--- | :--- | :--- | :--- |
| **Authentication & Session** | Signed JWT (HS256) with Issuer & Audience validation | Informational | **SECURE** |
| **Role-Based Access Control** | Strictly enforced at Express middleware level (`protect`, `authorize`) | Critical | **SECURE (Zero Bypass)** |
| **Horizontal Privilege Escalation** | Multi-tenant tenant/firm boundaries strictly verified via MongoDB query scoping | High | **SECURE** |
| **Vertical Privilege Escalation** | Client/Staff direct API calls to admin endpoints return HTTP 403 | High | **SECURE** |
| **Document Storage Security** | Private Cloudinary bucket; signed time-limited tokens (60s) for streaming | High | **SECURE** |
| **Security Headers** | Helmet enabled: HSTS (1 year), nosniff, frame-ancestors, CSP | Medium | **SECURE** |
| **CORS Configuration** | Untrusted origin reflection disabled; origins whitelist enforced | Medium | **SECURE** |
| **Microservice Key Security** | AI API key resides only on Render backend; never exposed to frontend | Critical | **SECURE** |
| **Audit Trail Immutability** | ActivityLog cannot be deleted or modified via API (`DELETE` / `PUT` returns 404) | Medium | **SECURE** |
| **JWT Malformed Exception** | Non-standard base64 token causing `SyntaxError` returns HTTP 500 instead of 401 | Low | **IDENTIFIED DEFECT** |

---

## 2. Detailed Threat Analysis & Verification Evidence

### 2.1 Authentication & JWT Handling
- **Implementation:** [jwt.js](file:///c:/Project/INTERNSHIP/Abitha/backend/utils/jwt.js), [authMiddleware.js](file:///c:/Project/INTERNSHIP/Abitha/backend/middleware/authMiddleware.js)
- **Token Verification:**
  - Token issuer: `clientlocker`
  - Token audience: `clientlocker-users`
  - Expiry: Configured via `JWT_EXPIRES_IN` (defaults to 1 day).
  - Secret: Protected by 32+ character environment secret (`JWT_SECRET`).
- **Account Verification:** Each protected request queries the active database to ensure `person.is_active === true` and `person.role === decoded.role`. Token revokes dynamically if an account is deactivated or altered.

### 2.2 Role-Based Access Control (RBAC) & Privilege Escalation Audit
Every role boundary was tested against direct HTTP request manipulation:

| Test Target | Attacker Role | Expected Response | Observed Response | Defense Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/activity` | Staff | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Privilege Escalation Blocked)** |
| `GET /api/activity` | Client | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Privilege Escalation Blocked)** |
| `GET /api/staff` | Client | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Privilege Escalation Blocked)** |
| `POST /api/files/:id/ai-suggest` | Auditor | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Write Operation Denied)** |
| `POST /api/files/:id/ai-suggest` | Client | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Write Operation Denied)** |
| `PATCH /api/checklist/:id` | Auditor | `HTTP 403 Forbidden` | `HTTP 403` | **PASS (Write Operation Denied)** |

### 2.3 Horizontal Multi-Tenant & Cross-Client Isolation (IDOR Checks)
- **Staff Cross-Client Check:**
  - Tested: Priya (Staff assigned to *Aadhavan Traders* and *Kurinji Enterprises*) attempted to access unassigned client *Meenakshi Textiles* (`6aec538cc40122d5cb902d21`) via `GET /api/clients/6aec538cc40122d5cb902d21/files`.
  - Backend executed `canAccessClient(user, clientId)`: Verified no `ClientAccess` record exists.
  - Result: Returned **`HTTP 403 Forbidden`** and logged an unauthorized access attempt in `ActivityLog`.
- **Client Cross-Client Check:**
  - Tested: *Aadhavan Traders* client account attempted to read *Meenakshi Textiles* checklist via `GET /api/clients/6aec538cc40122d5cb902d21/checklist`.
  - Result: Returned **`HTTP 403 Forbidden`**.

### 2.4 Cloudinary Storage & Document Protection
- **Private Storage:** Files uploaded to Cloudinary are stored with `type: "authenticated"` or private access flags. Direct URLs are never exposed in API responses or HTML markups.
- **Two-Tier Download Protection:**
  1. A user must request a signed download link via `POST /api/files/:fileId/link`. Backend generates a cryptographically random token (32 bytes), stores only its SHA-256 hash in MongoDB (`DownloadLink`), and sets a 60-second TTL.
  2. The download endpoint (`GET /api/links/:token`) streams the file buffer through Express.
  3. **Crucial Security Layer Verified:** `GET /api/links/:token` is wrapped in `protect` middleware! Even if an attacker intercepts a valid link token, requests without an active authenticated JWT session return **`HTTP 401 Unauthorized`**.

### 2.5 Security Headers & CORS Audit
Response headers from `https://clientlocker-qfz5.onrender.com` confirm full defensive suite:
- `strict-transport-security: max-age=31536000; includeSubDomains` (Enforces HTTPS across all subdomains)
- `x-content-type-options: nosniff` (MIME-sniffing protection)
- `x-frame-options: SAMEORIGIN` (Clickjacking prevention)
- `content-security-policy` (Restricts frame embedding and insecure script injections)
- `cross-origin-opener-policy: same-origin`
- `cross-origin-resource-policy: same-origin`
- **CORS Testing:** Sending requests with `Origin: https://malicious-third-party-site.com` resulted in no wildcard header reflection, preventing cross-origin data leakage.

### 2.6 Standalone-AI Integration Security
- **API Key Confidentiality:** The secret `AI_SERVICE_API_KEY` is maintained exclusively in the Render environment of `clientlocker-qfz5` and is never forwarded to client browsers.
- **Live Endpoint Hardening:**
  - `POST /api/v1/checklist/suggest` on `standalone-ai-clientlocker.onrender.com` requires `X-API-Key` or `Authorization: Bearer`.
  - Unauthenticated requests return `HTTP 401 {"detail":"API key is missing."}`.
  - Tampered keys return `HTTP 401 {"detail":"Invalid API key."}` using `hmac.compare_digest` to prevent timing attacks.

---

## 3. Vulnerability Findings & Safe Remediations

### VULN-01: Malformed Base64 JWT Returns HTTP 500 (Low Severity)
- **Description:** When an attacker or malformed client submits an invalid base64 token payload that cannot be parsed as JSON (e.g. `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.badtoken.xyz`), `jwt.verify` inside `authMiddleware.js` throws a native `SyntaxError` rather than a `JsonWebTokenError`.
- **Current Behavior:** The catch block checks for `TokenExpiredError`, `JsonWebTokenError`, and `NotBeforeError`, but falls through on `SyntaxError`, returning `HTTP 500 {"success":false,"message":"Authentication verification failed."}`.
- **Risk:** Minor information disclosure (reveals 500 status code); fails open to generic error handler.
- **Recommended Remediation:**
  In [authMiddleware.js](file:///c:/Project/INTERNSHIP/Abitha/backend/middleware/authMiddleware.js#L54-L63), catch `SyntaxError` alongside `JsonWebTokenError` and return `HTTP 401 Unauthorized`.

---

## 4. Security Verification Verdict

> [!IMPORTANT]
> **VERDICT: PRODUCTION SECURE**
> No Critical or High severity security vulnerabilities were found. All four user roles are strictly sandboxed, horizontal and vertical privilege escalations are denied at the controller layer, Cloudinary documents are non-public and token-protected, and the Standalone-AI microservice bridge enforces constant-time HMAC key authentication.
