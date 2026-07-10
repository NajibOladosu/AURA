# AURA — Intelligent Medical Triage

**Automated Urgent Response Assistant** — AI-powered emergency assistance and health assessment.

AURA is a medical triage application that uses Google's latest Gemini Flash models (including Gemini 3 Flash Preview and Gemini 2.5 Flash) to assess symptoms described via text, voice, or image and return structured risk-level evaluations with actionable care guidance. It locates nearby medical facilities using geolocation and provides a follow-up chat for additional questions.

Designed for speed in urgent situations, AURA works without requiring an account. Users can perform assessments immediately and optionally sign in to persist their data.

> ⚠️ **Medical Disclaimer** — AURA is **not a substitute for professional medical advice, diagnosis, or treatment.** It is an informational triage aid only, and its AI-generated assessments may be incomplete or incorrect. Always seek the advice of a qualified physician or other health provider with any questions about a medical condition. **Never disregard professional medical advice or delay seeking it because of something AURA has told you. If you think you may have a medical emergency, call your local emergency number immediately.**

---

## Features

- **AI Symptom Analysis** — Structured triage powered by the fastest Gemini Flash models with risk scoring, condition identification, and immediate action recommendations.
- **Encrypted Medical Record (EMR)** — Patient-owned health record (demographics, allergies, conditions, medications, immunizations, procedures, vitals history, and document/lab uploads). All PHI is encrypted at rest with AES-256-GCM, gated behind password re-authentication, and access is audit-logged. See [Patient Medical Record (EMR)](#patient-medical-record-emr).
- **Multi-Modal Input** — Text, speech-to-text voice input, or image upload for visual symptoms.
- **Guest-First Access** — Full triage functionality without sign-in. Guest sessions are stored locally in the browser and can be migrated to a permanent account.
- **Location-Aware Facilities** — Detects user location and surfaces nearby hospitals, urgent care centers, and pharmacies via Google Search grounding.
- **Emergency Detection** — Prominent alerts for life-threatening conditions with a direct call-to-action for emergency services.
- **Follow-Up Chat** — Conversational AI consultant for post-triage questions, with full session context.
- **Shareable Reports** — Generate and share triage reports via the Web Share API or download as images.
- **PII Scrubbing** — A preprocessing step removes personally identifiable information before sending data to the AI.
- **Dark/Light Mode** — Adaptive theming with dynamic logo and UI adjustments.

---

## Tech Stack

### Frontend
- React 19 with Vite and TypeScript
- Tailwind CSS (glassmorphism UI)
- Framer Motion (animations)
- Lucide React (icons)

### Backend
- Node.js and Express
- MongoDB Atlas via Mongoose
- JWT authentication with bcrypt
- Google GenAI SDK (`@google/genai`)
- express-rate-limit (guest rate limiting)

---

## Project Structure

```
aura/
├── client/                  # React SPA (Vite)
│   ├── App.tsx              # Main application (views, state, handlers)
│   ├── components/
│   │   ├── UIComponents.tsx # Shared UI primitives
│   │   └── emr/
│   │       └── EmrView.tsx  # Encrypted medical record UI (re-auth, vitals, docs, audit)
│   ├── lib/
│   │   └── types.ts         # TypeScript interfaces (incl. MedicalRecord)
│   ├── index.html           # Entry HTML with Tailwind config
│   └── vite.config.ts       # Vite config with API proxy
├── server/                  # Express API
│   ├── server.js            # Entry point, middleware, route mounting
│   ├── lib/
│   │   └── crypto.js        # AES-256-GCM field encryption for PHI
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── models/
│   │   ├── User.js          # User authentication model
│   │   ├── Profile.js       # Legacy medical profile (compat shim over MedicalRecord)
│   │   ├── MedicalRecord.js # Encrypted patient EMR
│   │   ├── AuditLog.js      # Append-only PHI access log
│   │   └── Session.js       # Triage sessions and chat history
│   ├── routes/
│   │   ├── auth.js          # Register, login, re-auth, token validation
│   │   ├── gemini.js        # AI triage, chat, places, geocoding
│   │   ├── history.js       # Session CRUD
│   │   ├── profile.js       # Legacy profile CRUD (backed by MedicalRecord)
│   │   └── emr.js           # Encrypted medical record CRUD, vitals, documents, export, audit
│   └── scripts/
│       └── verify-emr.mjs   # Offline encryption + model verification
├── docker-compose.yml
└── vercel.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (or local MongoDB instance)
- A [Google Gemini API key](https://aistudio.google.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/NajibOladosu/AURA.git
cd AURA
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
# 32-byte base64 key that encrypts the patient medical record (EMR).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
EMR_ENCRYPTION_KEY=your_base64_32_byte_key
```

> **Keep `EMR_ENCRYPTION_KEY` secret and back it up separately from the database.** All patient medical records are encrypted with it; losing it makes them unrecoverable. The server refuses to start if it is missing or malformed. See `server/.env.example`.

Start the backend:

```bash
npm run dev
```

The server runs on `http://localhost:5000`.

### 3. Frontend Setup

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`. API requests to `/api/*` are proxied to the backend automatically via Vite.

---

## Docker

AURA is fully containerized with multi-stage Dockerfiles for both services.

### Run with Docker Compose

Ensure the `server/.env` file is configured, then from the project root:

```bash
docker-compose up --build
```

The application will be available at `http://localhost:3000`.

### Docker Hub

Pre-built images are available:

- `najiboladosu/aura-server:latest`
- `najiboladosu/aura-client:latest`

---

## Vercel Deployment

AURA is configured for Vercel monorepo deployment. The client builds as a static site and the server runs as a Node.js serverless function.

1. Install the [Vercel CLI](https://vercel.com/docs/cli) and deploy:

```bash
vercel
```

2. Set environment variables (`MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMR_ENCRYPTION_KEY`) in the Vercel dashboard.

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `GEMINI_API_KEY` | Google Gemini API key |
| `EMR_ENCRYPTION_KEY` | Base64 32-byte key for AES-256-GCM encryption of patient medical records |

---

## Patient Medical Record (EMR)

Beyond the basic triage profile, AURA stores a structured, **encrypted** patient medical record (demographics, allergies, conditions, medications, immunizations, procedures, vitals history, and uploaded documents/labs).

Security model:

- **Encryption at rest** — all PHI is encrypted with AES-256-GCM (`server/lib/crypto.js`) before it reaches MongoDB. Only non-PHI metadata is stored in cleartext. The ciphertext is bound to the owning user via GCM additional authenticated data, so an encrypted record cannot be moved between accounts.
- **Re-authentication** — viewing the full record requires re-entering the password (`POST /api/auth/reauth`), which issues a short-lived, EMR-scoped access token.
- **Audit log** — every read, write, export, and document access is recorded to an append-only log the patient can review (`GET /api/emr/audit`).
- **Session hardening** — auth tokens expire after 1 day.
- **Data ownership** — patients can export their full record as JSON (`GET /api/emr/export`).

Verify the encryption + model layer (no database required):

```bash
cd server && npm run verify:emr
```

---

## Medical Disclaimer

AURA is provided for **informational and educational purposes only** and does **not** constitute medical advice, diagnosis, or treatment. The AI-generated risk levels, condition suggestions, and care recommendations are automated estimates that can be inaccurate, incomplete, or inappropriate for your specific situation.

- AURA is **not** a licensed medical provider and does not establish a doctor–patient relationship.
- Always consult a qualified healthcare professional for medical concerns.
- Never disregard or delay professional medical advice because of AURA output.
- **In an emergency, call your local emergency number (e.g. 911) or go to the nearest emergency department immediately** — do not rely on AURA.

By using AURA you acknowledge these limitations and accept full responsibility for any decisions made based on its output.

---

## License

This project is proprietary. All rights reserved.
