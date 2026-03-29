# AURA — Intelligent Medical Triage

**Automated Urgent Response Assistant** — AI-powered emergency assistance and health assessment.

AURA is a medical triage application that uses Google's latest Gemini Flash models (including Gemini 3 Flash Preview and Gemini 2.5 Flash) to assess symptoms described via text, voice, or image and return structured risk-level evaluations with actionable care guidance. It locates nearby medical facilities using geolocation and provides a follow-up chat for additional questions.

Designed for speed in urgent situations, AURA works without requiring an account. Users can perform assessments immediately and optionally sign in to persist their data.

---

## Features

- **AI Symptom Analysis** — Structured triage powered by the fastest Gemini Flash models with risk scoring, condition identification, and immediate action recommendations.
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
│   │   └── UIComponents.tsx # Shared UI primitives
│   ├── lib/
│   │   └── types.ts         # TypeScript interfaces
│   ├── index.html           # Entry HTML with Tailwind config
│   └── vite.config.ts       # Vite config with API proxy
├── server/                  # Express API
│   ├── server.js            # Entry point, middleware, route mounting
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── models/
│   │   ├── User.js          # User authentication model
│   │   ├── Profile.js       # Medical profile (allergies, conditions, medications)
│   │   └── Session.js       # Triage sessions and chat history
│   └── routes/
│       ├── auth.js          # Register, login, token validation
│       ├── gemini.js        # AI triage, chat, places, geocoding
│       ├── history.js       # Session CRUD
│       └── profile.js       # Profile CRUD
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
```

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

2. Set environment variables (`MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`) in the Vercel dashboard.

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `GEMINI_API_KEY` | Google Gemini API key |

---

## License

This project is proprietary. All rights reserved.
