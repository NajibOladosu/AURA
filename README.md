# AURA - Intelligent Medical Triage
  
  **Automated Urgent Response Assistant - AI-Powered Emergency Assistance & Health Assessment**

---

## 🌟 Overview

**AURA** is an advanced, AI-driven medical assessment and triage application designed to provide users with rapid, intelligent health insights and immediate emergency guidance. By leveraging Google's Gemini 2.5 Flash model, AURA can process symptom descriptions via text, voice, or image uploads, and immediately determine risk levels, outputting actionable care protocols.

With integrated **geolocation services**, AURA triangulates your exact coordinates to find the nearest and most relevant medical facilities (Hospitals, Urgent Care, Pharmacies) directly in the app.

---

## ✨ Key Features

- **🤖 AI Symptom Analysis:** Powered by Google's latest Gemini 2.5 Flash model for high-speed, accurate medical triage using the new `@google/genai` SDK.
- **📍 Location-Aware:** Automatically detects your location and uses Google Search Grounding to suggest nearby medical facilities.
- **🎙️ Multi-Modal Input:** Describe your symptoms via text, use the built-in speech-to-text voice recognition, or upload images/photos of visual symptoms.
- **🚨 Emergency Detection:** Instant, highlighted alerts for life-threatening conditions with a direct "Call Emergency Services" action.
- **📄 Shareable Reports:** Generate shareable image reports of your triage assessment using the Web Share API.
- **🔒 Secure & Private:** Features robust backend authentication (JWT) with reliable session persistence (you stay logged in after refresh), and a specialized AI agent step designed to scrub PII (Personally Identifiable Information) before queries are sent to the AI.
- **🌓 Adaptive Theming:** Full dark/light mode support with dynamic, theme-aware branding and logos.

---

## 🛠️ Tech Stack

### Frontend
- **React.js (Vite)**
- **Tailwind CSS** (for styling and glassmorphism UI)
- **Framer Motion** (for smooth animations and transitions)
- **Lucide React** (for iconography)

### Backend
- **Node.js & Express.js**
- **MongoDB & Mongoose** (for user profile and session history storage)
- **JWT & bcrypt** (for secure authentication)
- **Google GenAI SDK** (for Gemini API interaction)

---

## 🚀 Getting Started

Follow these instructions to set up and run the AURA application locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 or higher recommended)
- A [MongoDB](https://www.mongodb.com/) cluster (or local instance)
- A [Google Gemini API Key](https://aistudio.google.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/NajibOladosu/AURA.git
cd AURA
```

### 2. Backend Setup

Open a terminal and navigate to the `server` directory:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory with the following variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend development server:

```bash
npm run dev
```
*(The backend should now be running on `http://localhost:5000`)*

### 3. Frontend Setup

Open a new terminal window and navigate to the `client` directory:

```bash
cd client
npm install
```

Start the frontend development server:

```bash
npm run dev
```
*(The frontend will start on `http://localhost:3000`. All API requests to `/api/*` are automatically proxied to the backend on port 5000 via Vite proxy configuration.)*

---

## � Docker

For localized orchestration and ensuring environment parity, AURA is fully containerized.

### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) installed.

### Run with Docker Compose
1. Ensure your `.env` file is set up in the `server` directory.
2. From the project root, run:
```bash
docker-compose up --build
```
The application will be accessible at `http://localhost:3000`.

### Docker Hub Images
The images are also available on Docker Hub:
- **Server**: `najiboladosu/aura-server:latest`
- **Client**: `najiboladosu/aura-client:latest`

---

## ☁️ Vercel Deployment

AURA is configured for seamless deployment on Vercel as a monorepo.

1. Install the [Vercel CLI](https://vercel.com/docs/cli).
2. Login and deploy:
```bash
vercel
```
3. Follow the CLI prompts to link your project.
4. Set your environment variables (`MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`) in the Vercel Dashboard.