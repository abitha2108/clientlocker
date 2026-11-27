# ClientLocker – Secure Client Document Management System

ClientLocker is a secure client document management portal that helps accounting firms manage client documents, control user access, and organize financial records.

**Live link:** https://clientlocker-theta.vercel.app/

## Recordings

- **Working Application Flow:** https://drive.google.com/file/d/1KEHHSRG7wIo6-Or9x9akIGTmm3WYTKvi/view?usp=sharing
- **AI Workflow Demonstration:** https://drive.google.com/file/d/1KMTM9E4BvcueFyMmH3Dv3oAcKQFgCGWC/view?usp=sharing

## Test logins

All accounts below are made-up demonstration accounts created through the project seed data.

**Common password:** `ClientLocker@2026`

| Role | Email | Password |
|---|---|---|
| Partner | kavitha.partner@clientlocker.test | ClientLocker@2026 |
| Partner | arun.partner@clientlocker.test | ClientLocker@2026 |
| Staff | priya.staff@clientlocker.test | ClientLocker@2026 |
| Staff | karthik.staff@clientlocker.test | ClientLocker@2026 |
| Staff | divya.staff@clientlocker.test | ClientLocker@2026 |
| Staff | suresh.staff@clientlocker.test | ClientLocker@2026 |
| Staff | meena.staff@clientlocker.test | ClientLocker@2026 |
| Staff | gokul.trainee@clientlocker.test | ClientLocker@2026 |
| Client | aadhavan.traders.client@clientlocker.test | ClientLocker@2026 |
| Client | meenakshi.textiles.client@clientlocker.test | ClientLocker@2026 |
| Client | pandian.exports.client@clientlocker.test | ClientLocker@2026 |
| Client | vaigai.foods.client@clientlocker.test | ClientLocker@2026 |
| Client | thamarai.engineering.client@clientlocker.test | ClientLocker@2026 |
| Client | kurinji.enterprises.client@clientlocker.test | ClientLocker@2026 |
| Client | marutham.agencies.client@clientlocker.test | ClientLocker@2026 |
| Client | annamalai.stores.client@clientlocker.test | ClientLocker@2026 |
| Client | chola.packaging.client@clientlocker.test | ClientLocker@2026 |
| Client | ponni.agro.products.client@clientlocker.test | ClientLocker@2026 |
| Auditor | senthil.auditor@clientlocker.test | ClientLocker@2026 |

## What it does

1. Allows users to log in and access dashboards according to their roles: Partner, Staff, Client, and Auditor.
2. Allows authorized users to manage client records and staff-client assignments.
3. Allows staff to upload PDF, JPG, and PNG documents with a maximum file size of 4 MB.
4. Allows authorized users to view client documents, including filenames, uploader details, and upload dates.
5. Provides AI-assisted document checklist suggestions that staff can review and approve or reject.

## The AI feature

- **What it does:** ClientLocker uses a separate Python FastAPI microservice called Standalone-AI to analyze supported document text and suggest matching client checklist requirements. It returns a suggested checklist item, confidence score, and explanation. Authorized staff must approve a suggestion before the checklist is updated.
- **Which free model it uses:** The exact model name is not specified in the available project information. Confirm the model configured in the Standalone-AI service before submitting this README.
- **What happens if the AI service is not available:** The application can continue using its manual document and checklist workflow. AI suggestions are not automatically applied, and staff remain in control of checklist updates.

## My stack

| Part | Technology | Why I used it |
|---|---|---|
| Frontend | React.js | To build reusable and interactive user interfaces |
| Frontend tooling | Vite | For fast development and production builds |
| Styling | CSS3 | To create responsive layouts and application designs |
| Routing | React Router DOM | To navigate between application pages |
| API communication | Axios | To communicate with the backend |
| Animations | Framer Motion | To add interface animations |
| Icons | Lucide React | To provide consistent interface icons |
| Backend | Node.js and Express.js | To build API endpoints and application logic |
| Database | MongoDB | To store users, clients, documents, and application records |
| AI service | Python and FastAPI | To run the separate AI microservice |
| Document storage | Cloudinary | For document storage and delivery |
| Frontend hosting | Vercel | To deploy the frontend |
| Backend and AI hosting | Render | To host backend and AI services |
| Version control | Git and GitHub | To manage source code |
| Development tools | VS Code and Antigravity | For development and AI-assisted coding |

## Main design choices

- **Role-based access:** Different dashboards and permissions are provided for Partners, Staff, Clients, and Auditors.
- **Backend authorization:** Access decisions are enforced by the backend instead of relying only on frontend restrictions.
- **Private document handling:** Uploaded documents are associated with the relevant client and access is restricted to authorized users.
- **Separate AI architecture:** The AI functionality runs as an independent FastAPI microservice rather than being embedded in the React frontend.
- **Human approval:** AI suggestions remain pending until an authorized staff member reviews them.
- **Responsive interface:** The application uses a modern financial SaaS design with blue and purplish-blue colours, consistent typography, and responsive layouts.
- **Made-up seed data:** Demonstration records are used instead of real customer information.
- **Database design:** MongoDB is used for application data. Confirm the actual collection names from the backend models before listing them as database tables.

## How to run it on your computer

Clone the repository:

```bash
git clone https://github.com/abitha2108/clientlocker.git
cd clientlocker
```

Install and start the backend:

```bash
cd backend
npm install
npm start
```

Open another terminal and start the frontend:

```bash
cd clientlocker/frontend
npm install
npm run dev
```

Open the local application:

```text
http://localhost:5173
```

**Required settings (names only):**

Backend:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `AI_SERVICE_URL`
- `AI_SERVICE_API_KEY`
- `AI_SERVICE_TIMEOUT_MS`

Frontend:
- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

Create the required `.env` files locally and provide your own configured values. Never put real keys, passwords, or secrets in this README.

## How to run the tests

The exact test command depends on the scripts configured in the backend and frontend `package.json` files.

Check the available scripts using:

```bash
npm run
```

Run the test script configured in the relevant project directory. Replace this section with the exact test command after confirming the actual scripts.

## Made-up data

ClientLocker uses fictional demonstration data created through the project's database seed script.

The sample data includes:

- 1 accounting firm.
- 2 Partner accounts.
- 6 Staff accounts.
- 10 Client accounts.
- 1 Auditor account.
- 50 checklist items.

The demonstration firm is **Vaigai Vel & Associates**, based in Madurai, Tamil Nadu.

All names, email addresses, client records, and demonstration information are fictional. The project does not use real customer or client records in its seeded demonstration data.

## What works

- **Fully working:**
  - Core application login and role-based dashboards.
  - Client document upload and file listing.
  - Opening uploaded documents.
  - AI suggestion generation in the recorded verification workflow.
  - Pending AI suggestion review and manual approval.
  - Checklist update after approval.
  - Duplicate-review protection in the recorded AI workflow.

- **Partly done:**
  - Google OAuth configuration had one blocked/degraded notice in the reported production smoke test.
  - The full range of AI document types and failure scenarios should be tested further.

- **Skipped:**
  - No additional skipped feature is confirmed in the available project information. Update this section if any required internship feature was intentionally left unimplemented.

## What I would do differently with more time

- Improve automated testing across all user roles and permission scenarios.
- Expand AI testing to support more document formats and different document layouts.
- Improve error handling and monitoring for the separate AI service.
- Add more detailed audit reports and activity filtering.
- Improve performance and loading speed on all dashboards.
- Strengthen security testing for document access and temporary download links.
- Improve the user experience based on feedback from accounting staff.