import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

function scrubPII(text) {
    return text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE REDACTED]")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL REDACTED]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]");
}

function retrieveGuidelines(symptoms) {
    const lowercaseSymptoms = symptoms.toLowerCase();
    let guidelines = "";
    if (lowercaseSymptoms.includes("fever") || lowercaseSymptoms.includes("cough")) {
        guidelines += "CDC-INF-01: Isolate if fever exceeds 100.4 F. Suggest testing for common respiratory viruses.\n";
    }
    if (lowercaseSymptoms.includes("chest pain") || lowercaseSymptoms.includes("shortness of breath")) {
        guidelines += "AHA-CVD-99: CRITICAL. Any unexplained chest pain requires immediate emergency evaluation (Call 911).\n";
    }
    if (guidelines === "") {
        guidelines = "GEN-01: Monitor symptoms. If condition worsens or persists for 48 hours, seek medical consultation.\n";
    }
    return guidelines;
}

const TRIAGE_SCHEMA = {
    type: "object",
    properties: {
        riskLevel: { type: "string", description: "Classification of urgency: 'Emergency', 'Urgent', 'Consult', or 'Self-Care'." },
        riskScore: { type: "integer", description: "Integer score from 1 to 10 evaluating severity (10 being most critical)." },
        conditionTitle: { type: "string", description: "High-level summary of the potential issue." },
        summary: { type: "string", description: "A patient-friendly summary of the assessment." },
        medicalAnalysis: { type: "string", description: "Clinical reasoning and physiological analysis behind the symptom." },
        immediateActions: { type: "array", items: { type: "string" }, description: "Step-by-step immediate actions the patient should take." },
        suggestedFacilities: { type: "array", items: { type: "string" }, description: "Types of medical facilities suitable for this condition." },
        suggestedFollowUpQuestions: { type: "array", items: { type: "string" }, description: "Suggested questions the patient should ask their doctor or this AI." },
        citations: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    source: { type: "string", description: "Organization (e.g., WHO, NCDC)" },
                    protocolId: { type: "string", description: "The ID of the protocol (e.g., WHO-EMC-2024)" },
                    summary: { type: "string", description: "One sentence on how this guideline applies here." }
                },
                required: ["source", "protocolId", "summary"]
            }
        },
        disclaimer: { type: "string", description: "A required medical disclaimer stating this is AI advice, not a diagnosis." },
        detectedProfileUpdates: {
            type: "object",
            description: "Extract ONLY new, permanent medical facts mentioned by the user.",
            properties: {
                newAllergies: { type: "array", items: { type: "string" } },
                newConditions: { type: "array", items: { type: "string" } },
                newMedications: { type: "array", items: { type: "string" } }
            }
        }
    },
    required: ["riskLevel", "riskScore", "conditionTitle", "summary", "medicalAnalysis", "immediateActions", "suggestedFacilities", "citations", "disclaimer"]
};

router.post('/triage', authMiddleware, async (req, res) => {
    try {
        const { symptoms, userProfile, historyContext, base64Image, mimeType } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const safeSymptoms = scrubPII(symptoms);
        const retrievedDocs = retrieveGuidelines(safeSymptoms);

        const parts = [];
        if (base64Image) {
            parts.push({
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType || 'image/jpeg'
                }
            });
        }

        const profileText = `
            KNOWN PATIENT HISTORY (Permanent Record):
            - Allergies: ${userProfile?.allergies?.length > 0 ? userProfile.allergies.join(', ') : 'None known'}
            - Chronic Conditions: ${userProfile?.conditions?.length > 0 ? userProfile.conditions.join(', ') : 'None known'}
            - Current Medications: ${userProfile?.medications?.length > 0 ? userProfile.medications.join(', ') : 'None known'}

            RECENT CONSULTATION HISTORY:
            ${historyContext || "No recent consultations."}
        `;

        parts.push({
            text: `
                You are AURA, an AI medical triage system.
                
                STEP 1: ANALYZE input symptoms and visual evidence.
                STEP 2: RETRIEVE & APPLY the provided 'RELEVANT GUIDELINES' (RAG Context). You MUST cite these in the output.
                STEP 3: CROSS-REFERENCE with Patient History.
                STEP 4: DETERMINE Urgency.
                
                [RAG - RELEVANT KNOWLEDGE BASE]
                ${retrievedDocs}
                
                ${profileText}
                
                INPUT SYMPTOMS (Sanitized): "${safeSymptoms}"
            `
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: parts,
            config: {
                responseMimeType: "application/json",
                responseSchema: TRIAGE_SCHEMA,
                systemInstruction: "You are a safe, helpful, and professional medical triage AI. Always prioritize patient safety. If guidelines are provided, use them."
            }
        });

        const text = response.text;
        if (!text) {
            console.error("AI Response missing text:", response);
            throw new Error("No response from AI");
        }

        res.json(JSON.parse(text));

    } catch (error) {
        console.error("AI Triage Request Payload:", {
            symptomsLength: req.body?.symptoms?.length,
            hasImage: !!req.body?.base64Image,
            profile: !!req.body?.userProfile
        });
        console.error("AI Triage Detailed Error:", {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        res.status(500).json({
            error: 'Error processing AI request',
            details: error.message,
            type: error.name
        });
    }
});

router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const { history, triageContext, userProfile, newMessage, base64Image } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const safeMessage = scrubPII(newMessage);

        const profileText = `
            PATIENT MEDICAL PROFILE:
            - Allergies: ${userProfile?.allergies?.join(', ') || 'None'}
            - Conditions: ${userProfile?.conditions?.join(', ') || 'None'}
            - Medications: ${userProfile?.medications?.join(', ') || 'None'}
        `;

        const systemContext = `
            [SYSTEM CONTEXT]
            You are AURA, an AI medical consultant.
            
            TRIAGE REPORT:
            - Condition: ${triageContext.conditionTitle}
            - Risk Level: ${triageContext.riskLevel}
            - Analysis: ${triageContext.medicalAnalysis}
            - Guidelines Cited: ${triageContext.citations?.map(c => c.protocolId).join(', ') || 'None'}
            
            ${profileText}
            
            INSTRUCTIONS:
            - Answer follow-up questions professionally.
            - If the user provides new information that significantly worsens the prognosis, advise them to seek immediate care.
        `;

        let promptText = `${systemContext}\n\n[CHAT HISTORY]\n`;
        history.forEach(msg => {
            promptText += `${msg.role === 'user' ? 'Patient' : 'AURA'}: ${msg.text}\n`;
        });

        promptText += `Patient: ${safeMessage}\n`;
        promptText += `AURA:`;

        const parts = [];
        if (base64Image) {
            parts.push({
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg"
                }
            });
        }
        parts.push({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: parts,
            config: {
                systemInstruction: "You are a helpful, calm, and professional medical consultant."
            }
        });

        res.json({ reply: response.text || "I apologize, I couldn't process that request." });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: 'Error processing chat request' });
    }
});
router.post('/places', authMiddleware, async (req, res) => {
    try {
        const { lat, lng, facilityType } = req.body;
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Task: Find the top 3 ${facilityType} locations strictly near Lat: ${lat}, Lng: ${lng}.
                
                CRITICAL LOCATION RULES:
                1. Results MUST be within 50km of the provided coordinates.
                2. Do NOT infer a location if you cannot find exact matches.
                3. Do NOT provide results from other countries.
                
                Output Requirements:
                - Output ONLY a JSON array.
                - Structure: [{"name": "Place Name", "rating": "4.5", "address": "Full Address with City/Zip", "googleMapsUri": "https://maps.google.com/..."}]
                - If 'googleMapsUri' is unavailable from the tool, leave it as an empty string.
                - Ensure 'address' is complete.
                - Do NOT write conversational text.
                - Do NOT use markdown code blocks.
                - Do NOT use JSON code blocks.
            `,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                        latLng: { latitude: lat, longitude: lng }
                    }
                }
            }
        });

        let text = response.text || "[]";
        let placesRaw;
        try {
            placesRaw = JSON.parse(text);
        } catch {
            const match = text.match(/\[[\s\S]*\]/);
            placesRaw = match ? JSON.parse(match[0]) : [];
        }

        const places = placesRaw.map((p) => ({
            name: p.name || "Unknown Facility",
            rating: p.rating || undefined,
            address: p.address || undefined,
            googleMapsUri: p.googleMapsUri || undefined
        }));

        res.json(places);
    } catch (error) {
        console.error("Maps Error:", error);
        res.status(500).json({ error: 'Error processing places request' });
    }
});

router.post('/geocode', authMiddleware, async (req, res) => {
    try {
        const { locationName } = req.body;
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "API Key missing" });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Get the latitude, longitude and standard formatted address for "${locationName}". Return strictly JSON: { "lat": number, "lng": number, "address": "string" }.`,
            config: {
                responseMimeType: "application/json"
            }
        });

        res.json(JSON.parse(response.text || "{}"));
    } catch (e) {
        console.error("Geocoding failed", e);
        res.status(500).json({ error: 'Failed to geocode' });
    }
});

router.post('/reverse-geocode', authMiddleware, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "API Key missing" });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `What is the City, Region (and Country if applicable) for coordinates ${lat}, ${lng}? Return ONLY the location name string (e.g. "San Francisco, CA"). Do not include other text.`
        });

        res.json({ name: response.text?.trim() || "Unknown Location" });
    } catch (e) {
        console.error("Reverse geocoding failed", e);
        res.status(500).json({ error: 'Failed to reverse geocode' });
    }
});

export default router;
