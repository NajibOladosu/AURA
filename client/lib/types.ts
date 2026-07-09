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

// ---- EMR (encrypted patient medical record) --------------------------------

export interface Insurance {
  provider: string | null;
  memberId: string | null;
  groupId: string | null;
}

export interface Demographics {
  dob: string | null;
  sex: string | null;
  bloodType: string | null;
  heightCm: number | null;
  weightKg: number | null;
  phone: string | null;
  address: string | null;
  insurance: Insurance;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
}

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening';

export interface Allergy {
  id: string;
  substance: string;
  reaction: string | null;
  severity: AllergySeverity | null;
}

export type ConditionStatus = 'active' | 'resolved' | 'chronic';

export interface Condition {
  id: string;
  name: string;
  status: ConditionStatus;
  diagnosedDate: string | null;
  notes: string | null;
}

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  active: boolean;
}

export interface Immunization {
  id: string;
  vaccine: string;
  date: string | null;
  notes: string | null;
}

export interface Procedure {
  id: string;
  name: string;
  date: string | null;
  notes: string | null;
}

export type VitalType = 'bp' | 'hr' | 'temp' | 'glucose' | 'spo2' | 'weight';

export interface Vital {
  id: string;
  type: VitalType;
  value: string | number;
  unit: string | null;
  measuredAt: number;
}

export type DocumentCategory = 'lab' | 'imaging' | 'note' | 'other';

export interface MedicalDocumentMeta {
  id: string;
  filename: string;
  mimeType: string;
  category: DocumentCategory;
  uploadedAt: number;
}

export interface MedicalRecord {
  demographics: Demographics;
  emergencyContacts: EmergencyContact[];
  allergies: Allergy[];
  conditions: Condition[];
  medications: Medication[];
  immunizations: Immunization[];
  procedures: Procedure[];
  vitals: Vital[];
  documents: MedicalDocumentMeta[];
}

export interface AuditEntry {
  action: 'read' | 'write' | 'export' | 'document_access' | 'reauth';
  resource: string;
  ip?: string;
  at: number;
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
  clarifyingQuestions?: string[];
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

export interface AdminStats {
  generatedAt: string;
  overview: { totalUniqueVisitors: number; dau: number; wau: number };
  triages: { guest: number; authenticated: number; total: number };
  registrations: { total: number };
  conversion: { guestTriageVisitors: number; converted: number; ratePercent: string };
  timeSeries: {
    triages7d: Array<{ _id: string; count: number; guestCount: number; authCount: number }>;
    registrations7d: Array<{ _id: string; count: number }>;
  };
}

export interface HistorySession {
  id: string;
  userId: string; // Linked to specific user
  timestamp: number;
  result: TriageResult;
  chatHistory: ChatMessage[];
  nearbyPlaces: Place[];
}