# CodeGuardian Frontend

Modern security analysis dashboard for CodeGuardian, built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 Features

- **GitHub Repository Scanner**: Directly paste any GitHub repository URL (public or private), select scan profile (`quick`, `standard`, `deep`), and automatically trigger end-to-end security analysis.
- **Real-Time Scan Pipeline Monitoring**: Interactive live view polling the 6 scan execution stages (Ingestion -> AST SAST -> Secrets Scanning -> Dependency SCA -> Normalization -> Risk Scoring).
- **Vulnerability Triage Workbench**: Filter findings by severity (Critical, High, Medium, Low) and triage status (Open, Fix in Progress, Fixed, False Positive, Accepted Risk).
- **AI Remediation Intelligence**: One-click generation of contextual explanations, attack scenarios, and remediation patches with confidence metrics.
- **Audit & Compliance Reporting**: Download standalone executive HTML audit reports and JSON digests.
- **Enterprise Dark Theme**: Glassmorphic UI with micro-animations, glowing accents, and reactive status indicators.

---

## 🛠️ Getting Started

### 1. Requirements
- Node.js >= 18.x
- Backend running on `http://127.0.0.1:8000`

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Default variables:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=CodeGuardian
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 3. Install & Run Locally

```bash
npm install
npm run dev
```

The application will be live at [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Platform Admin | `admin@codeguardian.io` | `GuardianPass123!` |

*(Or register a new account directly from the auth screen.)*
