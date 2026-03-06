# AURA - Intelligent Medical Triage
  
  **AI-Powered Emergency Assistance & Health Assessment**

  [![GitHub repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/NajibOladosu/AURA)

---

## 🌟 Overview

**AURA** is an advanced, AI-driven medical assessment and triage application designed to provide users with rapid, intelligent health insights and immediate emergency guidance. By leveraging Google's Gemini 2.5 Flash model, AURA can process symptom descriptions via text, voice, or image uploads, and immediately determine risk levels, outputting actionable care protocols.

With integrated **geolocation services**, AURA triangulates your exact coordinates to find the nearest and most relevant medical facilities (Hospitals, Urgent Care, Pharmacies) directly in the app.

---

## ✨ Key Features

- **🤖 AI Symptom Analysis:** Powered by Google Gemini 2.5 Flash for high-speed, accurate medical triage.
- **📍 Location-Aware:** Automatically detects your location to suggest nearby medical facilities (uses browser Geolocation API and Google Maps integrations).
- **🎙️ Multi-Modal Input:** Describe your symptoms via text, use the built-in speech-to-text voice recognition, or upload images/photos of visual symptoms.
- **🚨 Emergency Detection:** Instant, highlighted alerts for life-threatening conditions with a direct "Call Emergency Services" action.
- **📄 Shareable Reports:** Generate shareable image reports of your triage assessment using the Web Share API.
- **🔒 Secure & Private:** Features backend authentication (JWT) and a specialized AI agent step designed to scrub PII (Personally Identifiable Information) before queries are sent to the AI.
- **🌓 Dark/Light Mode:** Full theming support for comfortable use in any environment.

---

## 🛠️ Tech Stack

### Frontend
- **React.js (Vite)**
- **Tailwind CSS** (for styling and glassmorphism UI)
- **Framer Motion** (for smooth animations and transitions)
- **Lucide React** (for iconography)
- **html2canvas** (for generating shareable report images)

### Backend
- **Node.js & Express.js**
- **MongoDB & Mongoose** (for user profile and session history storage)
- **JWT & bcrypt** (for secure authentication)
- **Google GenAI SDK** (for Gemini API interaction)

---

## 🚀 Getting Started

Follow these instructions to set up and run the AURA application locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
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
*(The frontend will start and typically be accessible at `http://localhost:5173` or `http://localhost:3000`)*

---

## 📱 Usage

1. **Sign Up / Log In**: Create an account or log in to start a secure session.
2. **Setup Profile**: (Optional) Add chronic conditions, allergies, or medications to inform the AI contextually.
3. **Describe Symptoms**: Use the text area, microphone, or camera buttons to input what you're experiencing.
4. **View Assessment**: AURA will process the input and return a Risk Level (Self-Care, Urgent, Emergency), a summary, immediate actions, and nearby facilities based on your location.
5. **Share/Save**: Use the "Share Report" feature to export your triage result as an image.
