import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TriageResult, Place, ChatMessage, UserProfile } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- RAG: Simulated Vector Database ---
const KNOWLEDGE_BASE = [
  {
    id: 'WHO-EMC-2024',
    keywords: ['fever', 'headache', 'sweat', 'chills'],
    text: 'WHO Guidelines for Febrile Illness: In malaria-endemic regions, immediate testing is required for high fever. Check hydration status and rule out dengue if rash is present.'
  },
  {
    id: 'NCDC-RESP-01',
    keywords: ['cough', 'breath', 'chest', 'wheeze'],
    text: 'NCDC Respiratory Protocol: Evaluate oxygen saturation. Rule out pneumonia in patients with high fever and productive cough. Isolate if viral pathogen suspected.'
  },
  {
    id: 'AHA-CARD-22',
    keywords: ['chest', 'heart', 'pain', 'pressure', 'arm'],
    text: 'AHA Acute Coronary Syndrome Guidelines: Chest pain radiating to the left arm or jaw constitutes a potential emergency. Immediate ECG and troponin levels recommended.'
  },
  {
    id: 'AAD-DERM-05',
    keywords: ['rash', 'itch', 'skin', 'redness'],
    text: 'AAD Dermatological Assessment: Non-blanching rashes associated with fever (petechiae) require immediate emergency care to rule out meningitis or sepsis.'
  }
];

function retrieveGuidelines(symptoms: string): string {
  const input = symptoms.toLowerCase();
  const relevantDocs = KNOWLEDGE_BASE.filter(doc => 
    doc.keywords.some(keyword => input.includes(keyword))
  );

  if (relevantDocs.length === 0) return "No specific protocol matches found in local knowledge base. Rely on general medical training.";

  return relevantDocs.map(doc => `[SOURCE: ${doc.id}] ${doc.text}`).join('\n');
}

// --- PII Redaction Layer ---
function scrubPII(text: string): string {
  return text
    // Redact Emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    // Redact US Phone Numbers (simple patterns)
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
    // Redact SSN-like patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ID_REDACTED]');
}

const TRIAGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: {
      type: Type.STRING,
      enum: ['Emergency', 'Urgent', 'Consult', 'Self-Care'],
      description: "The triage classification category."
    },
    riskScore: {
      type: Type.NUMBER,
      description: "A risk score from 1 (Safe) to 10 (Critical Emergency)."
    },
    conditionTitle: {
      type: Type.STRING,
      description: "A short, professional title for the suspected condition or symptom cluster."
    },
    summary: {
      type: Type.STRING,
      description: "A 1-sentence summary for the patient."
    },
    medicalAnalysis: {
      type: Type.STRING,
      description: "Detailed medical reasoning explaining why this risk level was chosen."
    },
    immediateActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 immediate steps the user should take."
    },
    suggestedFacilities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Types of facilities to visit (e.g., 'Emergency Room', 'Pharmacy', 'GP Clinic')."
    },
    suggestedFollowUpQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3 short, relevant questions the user might want to ask the AI next."
    },
    citations: {
      type: Type.ARRAY,
      description: "List of medical guidelines or protocols used for this triage. MUST reference the 'RELEVANT GUIDELINES' provided in context.",
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING, description: "Organization (e.g., WHO, NCDC)" },
          protocolId: { type: Type.STRING, description: "The ID of the protocol (e.g., WHO-EMC-2024)" },
          summary: { type: Type.STRING, description: "One sentence on how this guideline applies here." }
        },
        required: ["source", "protocolId", "summary"]
      }
    },
    disclaimer: {
      type: Type.STRING,
      description: "A required medical disclaimer stating this is AI advice, not a diagnosis."
    },
    detectedProfileUpdates: {
      type: Type.OBJECT,
      description: "Extract ONLY new, permanent medical facts mentioned by the user.",
      properties: {
        newAllergies: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        newConditions: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        newMedications: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }
  },
  required: ["riskLevel", "riskScore", "conditionTitle", "summary", "medicalAnalysis", "immediateActions", "suggestedFacilities", "citations", "disclaimer"]
};

export async function performTriage(
  symptoms: string, 
  userProfile: UserProfile,
  historyContext: string,
  base64Image?: string, 
  mimeType: string = 'image/jpeg'
): Promise<TriageResult> {

  // 1. PII Redaction
  const safeSymptoms = scrubPII(symptoms);

  // 2. RAG Retrieval
  const retrievedDocs = retrieveGuidelines(safeSymptoms);

  const parts: any[] = [];
  
  if (base64Image) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    });
  }

  // Format profile for prompt
  const profileText = `
    KNOWN PATIENT HISTORY (Permanent Record):
    - Allergies: ${userProfile.allergies.length > 0 ? userProfile.allergies.join(', ') : 'None known'}
    - Chronic Conditions: ${userProfile.conditions.length > 0 ? userProfile.conditions.join(', ') : 'None known'}
    - Current Medications: ${userProfile.medications.length > 0 ? userProfile.medications.join(', ') : 'None known'}

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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: TRIAGE_SCHEMA,
        thinkingConfig: {
          thinkingBudget: 2048
        },
        systemInstruction: "You are a safe, helpful, and professional medical triage AI. Always prioritize patient safety. If guidelines are provided, use them."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as TriageResult;
  } catch (error) {
    console.error("Triage Error:", error);
    throw error;
  }
}

export async function findNearbyPlaces(
  lat: number, 
  lng: number, 
  facilityType: string
): Promise<Place[]> {
  try {
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
    
    const places: Place[] = placesRaw.map((p: any) => ({
      name: p.name || "Unknown Facility",
      rating: p.rating || undefined,
      address: p.address || undefined,
      googleMapsUri: p.googleMapsUri || undefined
    }));

    return places;
    
  } catch (e) {
    console.error("Maps Error", e);
    return [];
  }
}

export async function geocodeLocation(locationName: string): Promise<{lat: number, lng: number, address: string} | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Get the latitude, longitude and standard formatted address for "${locationName}". Return strictly JSON: { "lat": number, "lng": number, "address": "string" }.`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Geocoding failed", e);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `What is the City, Region (and Country if applicable) for coordinates ${lat}, ${lng}? Return ONLY the location name string (e.g. "San Francisco, CA"). Do not include other text.`,
    });
    return response.text?.trim() || "Unknown Location";
  } catch (e) {
    console.error("Reverse geocoding failed", e);
    return "GPS Location";
  }
}

export async function sendFollowUp(
  history: ChatMessage[],
  triageContext: TriageResult,
  userProfile: UserProfile,
  newMessage: string,
  base64Image?: string
): Promise<string> {
  const parts: any[] = [];
  
  // PII Redaction for chat
  const safeMessage = scrubPII(newMessage);

  const profileText = `
    PATIENT MEDICAL PROFILE:
    - Allergies: ${userProfile.allergies.join(', ') || 'None'}
    - Conditions: ${userProfile.conditions.join(', ') || 'None'}
    - Medications: ${userProfile.medications.join(', ') || 'None'}
  `;
  
  const systemContext = `
    [SYSTEM CONTEXT]
    You are AURA, an AI medical consultant.
    
    TRIAGE REPORT:
    - Condition: ${triageContext.conditionTitle}
    - Risk Level: ${triageContext.riskLevel}
    - Analysis: ${triageContext.medicalAnalysis}
    - Guidelines Cited: ${triageContext.citations.map(c => c.protocolId).join(', ')}
    
    ${profileText}
    
    INSTRUCTIONS:
    - Answer follow-up questions professionally.
    - If the user provides new information that significantly worsens the prognosis, advise them to seek immediate care.
  `;

  let prompt = `${systemContext}\n\n[CHAT HISTORY]\n`;
  history.forEach(msg => {
    prompt += `${msg.role === 'user' ? 'Patient' : 'AURA'}: ${msg.text}\n`;
  });
  
  prompt += `Patient: ${safeMessage}\n`;
  prompt += `AURA:`;

  parts.push({ text: prompt });

  if (base64Image) {
    parts.unshift({
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction: "You are a helpful, calm, and professional medical consultant."
    }
  });

  return response.text || "I apologize, I couldn't process that request.";
}