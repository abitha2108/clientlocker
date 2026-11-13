# 🔐 ClientLocker – Secure Client Document Management System

<p align="center">
  <strong>Your Documents. Our Priority.</strong>
</p>

<p align="center">
  A modern and secure client document management portal for accounting firms.
</p>

<p align="center">
  <a href="https://clientlocker-theta.vercel.app/"><strong>🌐 Visit Live Website</strong></a>
</p>

---

## 🚀 Live Demo

**Production Website:** [https://clientlocker-theta.vercel.app/](https://clientlocker-theta.vercel.app/)

## Drive Link

**Working Flow**

[https://drive.google.com/file/d/1KEHHSRG7wIo6-Or9x9akIGTmm3WYTKvi/view?usp=sharing]

## 📌 Project Overview

ClientLocker is a private client document management system developed for **Vaigai Vel & Associates**, an accounting firm in Madurai, Tamil Nadu.

The platform helps accounting firms securely upload, organize, manage, and access confidential client documents through a centralized portal.

It provides role-based access control to ensure users can access only the documents and client information they are authorized to view.

## 🎯 Project Objectives

- Securely manage confidential client documents.
- Organize financial, tax, and business records.
- Provide role-based access control.
- Manage staff and client assignments.
- Enable secure document sharing.
- Maintain activity records.
- Provide controlled auditor access.
- Improve document management efficiency.

## 👥 User Roles

| Role | Responsibilities |
|---|---|
| Partner | Manage clients, staff assignments and document access |
| Staff | Manage documents for assigned clients |
| Client | Access authorized personal documents |
| Auditor | Review documents belonging to assigned clients |

## ✨ Key Features

- Modern public landing page.
- Responsive user interface.
- User authentication.
- Role-based dashboards.
- Client management.
- Secure document upload and management.
- Financial document organization.
- Tax document management.
- Business record management.
- Staff-client assignments.
- Activity logging.
- Secure magic-link client access.
- Temporary document download links.
- AI-powered document checklist suggestions.

*Feature availability depends on milestone implementation. M3 features are separate from the M2 submission.*

---

# 📦 M2 Submission – Core Application Flow

**Milestone:** M2 – Tool Online with One Complete Flow Working

**Submission Date:** 13 November 2026

The M2 milestone focuses on implementing the core ClientLocker workflow, including database setup, authentication, role-based dashboards, client document uploads, file listing, and opening uploaded documents.

## 1. Database and Seed Data

The application uses MongoDB to store application data.

The database is populated with made-up demonstration data.

**Seeded records:**

| Entity | Number of Records |
|---|---:|
| Firm | 1 |
| Partners | 2 |
| Staff | 6 |
| Clients | 10 |
| Client login accounts | 10 |
| Auditor | 1 |
| Checklist items | 50 |

**Firm Name:** Vaigai Vel & Associates

The seed script also creates staff-client assignments and auditor access to two clients.

## 2. Authentication and Role-Based Access

The application supports email and password authentication for the following M2 roles:

- Partner
- Staff
- Client

After successful login, users are directed to their respective dashboards based on their authenticated role.

| Role | Dashboard |
|---|---|
| Partner | Partner Dashboard |
| Staff | Staff Dashboard |
| Client | Client Dashboard |

The backend determines the authenticated user's role rather than trusting a role supplied by the frontend.

## 3. Document Upload and Management

ClientLocker supports uploading the following document formats:

| File Type | Supported |
|---|---|
| PDF | Yes |
| JPG | Yes |
| PNG | Yes |

**Upload restrictions:**

- Maximum file size: 4 MB.
- Files are stored in private storage.
- Uploaded files are associated with the relevant client.
- File type and file size are validated.

## 4. Client File Listing

Each client has a file listing displaying:

- Document filename.
- Name of the person who uploaded the document.
- Upload date.

Authorized users can access the relevant client documents through the application.

## 5. Complete M2 Demonstration Flow

The M2 demonstration covers the following workflow:

1. Open the ClientLocker production website.
2. Log in using a test account.
3. Access the appropriate role-based dashboard.
4. Open a client record.
5. Upload a sample PDF, JPG, or PNG document.
6. View the uploaded document in the client file list.
7. Open the uploaded document.

## 6. M2 Test Login Credentials

The following accounts are created by the database seed script and can be used for demonstration.

**Common Demo Password for All Accounts:**

```text
ClientLocker@2026
```
### Partner Accounts

| Name | Email | Password |
|---|---|---|
| Kavitha Vel | kavitha.partner@clientlocker.test | ClientLocker@2026 |
| Arun Vel | arun.partner@clientlocker.test | ClientLocker@2026 |

### Staff Accounts

| Name | Email | Password |
|---|---|---|
| Priya Raman | priya.staff@clientlocker.test | ClientLocker@2026 |
| Karthik Kumar | karthik.staff@clientlocker.test | ClientLocker@2026 |
| Divya Raj | divya.staff@clientlocker.test | ClientLocker@2026 |
| Suresh Balan | suresh.staff@clientlocker.test | ClientLocker@2026 |
| Meena Joseph | meena.staff@clientlocker.test | ClientLocker@2026 |
| Gokul Trainee | gokul.trainee@clientlocker.test | ClientLocker@2026 |

### Client Accounts

| Client | Email | Password |
|---|---|---|
| Aadhavan Traders | aadhavan.traders.client@clientlocker.test | ClientLocker@2026 |
| Meenakshi Textiles | meenakshi.textiles.client@clientlocker.test | ClientLocker@2026 |
| Pandian Exports | pandian.exports.client@clientlocker.test | ClientLocker@2026 |
| Vaigai Foods | vaigai.foods.client@clientlocker.test | ClientLocker@2026 |
| Thamarai Engineering | thamarai.engineering.client@clientlocker.test | ClientLocker@2026 |
| Kurinji Enterprises | kurinji.enterprises.client@clientlocker.test | ClientLocker@2026 |
| Marutham Agencies | marutham.agencies.client@clientlocker.test | ClientLocker@2026 |
| Annamalai Stores | annamalai.stores.client@clientlocker.test | ClientLocker@2026 |
| Chola Packaging | chola.packaging.client@clientlocker.test | ClientLocker@2026 |
| Ponni Agro Products | ponni.agro.products.client@clientlocker.test | ClientLocker@2026 |

### Auditor Account (M3)

| Name | Email | Password |
|---|---|---|
| Senthil Nathan | senthil.auditor@clientlocker.test | ClientLocker@2026 |


All seeded Partner, Staff, Client, and Auditor accounts use this same demonstration password.

*These are made-up test accounts created for the internship project. They are not real customer accounts.*

## 7. M2 Screen Recording

**Required:** 60-second screen recording demonstrating one complete working flow.

**Recording:** [Add your Google Drive recording link here]

The recording should demonstrate:

- User login.
- Role-based dashboard.
- Client document upload.
- Uploaded document appearing in the file list.
- Opening the uploaded document.

*Set Google Drive sharing to "Anyone with the link" so the reviewer can access the recording.*

---

## 🛠️ Technology Stack

### Frontend

- React.js
- Vite
- JavaScript
- CSS3
- React Router DOM
- Axios
- Framer Motion
- Lucide React

### Backend

- Node.js
- Express.js

### Database

- MongoDB

### Tools and Deployment

- GitHub – Version Control
- Vercel – Frontend Hosting
- Render – Backend Hosting
- Visual Studio Code – Development Environment
- Antigravity – AI-Assisted Development

## 📂 Project Structure

```text
clientlocker/
│
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── scripts/
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   └── layout/
│   │   ├── context/
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   ├── auth/
│   │   │   ├── partner/
│   │   │   ├── staff/
│   │   │   └── auditor/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── docs/
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

- Node.js
- npm
- Git
- MongoDB

### 1. Clone Repository

```bash
git clone https://github.com/abitha2108/clientlocker.git
```

### 2. Navigate to Frontend

```bash
cd clientlocker/frontend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Frontend Environment Variables

Create a `.env` file inside the frontend folder.

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Use your configured backend URL and Google Client ID where applicable.

### 5. Start Frontend Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

### 6. Configure Backend Environment Variables

Create a `.env` file inside the backend folder.

Configure the required variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

Add any additional Cloudinary, email, or Google credentials required by your backend configuration.

Never commit `.env` files or secret credentials to GitHub.

### 7. Start Backend Development Server

From the backend directory:

```bash
npm install
npm start
```

Use the start script configured in your backend `package.json`.

### 8. Build for Production

From the frontend directory:

```bash
npm run build
```

Production files will be generated inside the `dist` directory.

---

## 🔒 Security Considerations

- Enforce authorization on backend APIs.
- Restrict access to assigned client records.
- Store confidential documents in private storage.
- Use expiring document access links.
- Protect environment variables.
- Record important user activities.
- Never commit credentials or `.env` files to GitHub.
- Use made-up test data for demonstrations.

## 🎨 UI and Design

ClientLocker follows a modern financial SaaS design approach.

**Design highlights:**

- Professional blue and purplish-blue colour identity.
- Modern typography.
- Responsive layouts.
- Animated user interface.
- Interactive document management illustration.
- Professional navigation.
- Clean dashboard-style components.

## 🚀 Deployment

The frontend application is deployed using Vercel.

**Live Production URL:**

[https://clientlocker-theta.vercel.app/](https://clientlocker-theta.vercel.app/)

The backend application is hosted using Render.

## 👨‍💻 Project Information

| Detail | Information |
|---|---|
| Project Name | ClientLocker |
| Client | Vaigai Vel & Associates |
| Industry | Accounting and Document Management |
| Location | Madurai, Tamil Nadu, India |
| Developer | Gowtham |
| Internship | Vizdale Full-Stack Developer Internship |
| Development Period | November 2026 |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Database | MongoDB |

## 📈 Future Enhancements – M3 and Beyond

- Server-side access restrictions for assigned clients.
- Client magic-link authentication.
- Temporary secure download links.
- Activity logging and access tracking.
- Auditor role with restricted client access.
- AI-powered document checklist suggestions.
- Automated document categorization.
- Advanced audit reports.
- Enhanced activity monitoring.
- Additional security improvements.

## 📝 M2 Submission Notes

This README documents the ClientLocker project and its M2 core application flow.

The M2 submission includes:

- Live application.
- Database with made-up seeded records.
- Partner, Staff, and Client test login accounts.
- Role-based authentication and dashboards.
- Client document upload functionality.
- Client file listing and opening functionality.
- A 60-second screen recording demonstrating the complete workflow.

Features planned for later milestones are identified separately and should not be considered completed unless implemented and tested.

---

<p align="center">
  <strong>ClientLocker – Your Documents. Our Priority.</strong>
</p>

<p align="center">
  Built with ❤️ for secure and reliable document management.
</p>