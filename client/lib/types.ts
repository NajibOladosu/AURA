export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: number;
}

export interface UserProfile {
  allergies: string[];
  conditions: string[]; // Chronic conditions
  medications: string[];
}

export interface Citation {
  source: string;
  protocolId: string;
  summary: string;
}

export interface TriageResult {
  riskLevel: 'Emergency' | 'Urgent' | 'Consult' | 'Self-Care';
  riskScore: number; // 1-10
  conditionTitle: string;
  summary: string;
  medicalAnalysis: string;
  immediateActions: string[];
  suggestedFacilities: string[];
  suggestedFollowUpQuestions: string[];
  disclaimer: string;
  citations: Citation[];
  detectedProfileUpdates?: {
    newAllergies: string[];
    newConditions: string[];
    newMedications: string[];
  };
}

export interface AgentState {
  name: string;
  status: 'idle' | 'working' | 'complete';
  message: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
}

export interface Place {
  name: string;
  address?: string;
  rating?: string; // Formatted rating
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
}

export interface HistorySession {
  id: string;
  userId: string; // Linked to specific user
  timestamp: number;
  result: TriageResult;
  chatHistory: ChatMessage[];
  nearbyPlaces: Place[];
}