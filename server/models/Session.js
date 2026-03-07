import mongoose from 'mongoose';

// Ensure the schema mirrors the TriageResult TypeScript interface
const triageResultSchema = new mongoose.Schema({
    riskLevel: { type: String, enum: ['Emergency', 'Urgent', 'Consult', 'Self-Care'], required: true },
    riskScore: { type: Number, required: true },
    conditionTitle: { type: String, required: true },
    summary: { type: String, required: true },
    medicalAnalysis: { type: String, required: true },
    immediateActions: [{ type: String }],
    suggestedFacilities: [{ type: String }],
    suggestedFollowUpQuestions: [{ type: String }],
    disclaimer: { type: String, required: true },
    citations: [{
        source: String,
        protocolId: String,
        summary: String
    }],
    detectedProfileUpdates: {
        newAllergies: [String],
        newConditions: [String],
        newMedications: [String]
    }
}, { _id: false, bufferCommands: false });

const chatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true },
    image: { type: String }, // Base64
    timestamp: { type: Number, default: () => Date.now() }
}, { _id: false, bufferCommands: false });

const placeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    rating: String,
    userRatingCount: Number,
    googleMapsUri: String,
    websiteUri: String
}, { _id: false, bufferCommands: false });

const sessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Number, default: () => Date.now() },
    result: { type: triageResultSchema, required: true },
    chatHistory: [chatMessageSchema],
    nearbyPlaces: [placeSchema]
}, { bufferCommands: false });

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);
