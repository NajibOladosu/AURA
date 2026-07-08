import mongoose from 'mongoose';
import { encryptJSON, decryptJSON } from '../lib/crypto.js';

const SCHEMA_VERSION = 1;

// Only non-PHI metadata is stored in cleartext. All PHI lives inside the
// `encryptedData` blob (AES-256-GCM). See docs/superpowers/specs for the shape.
const encryptedBlobSchema = new mongoose.Schema({
    keyId: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
}, { _id: false });

const medicalRecordSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    schemaVersion: { type: Number, default: SCHEMA_VERSION },
    encryptedData: { type: encryptedBlobSchema, required: true },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
}, { bufferCommands: false });

// Empty PHI payload — the canonical shape of the decrypted blob.
export function emptyPHI() {
    return {
        demographics: {
            dob: null, sex: null, bloodType: null, heightCm: null, weightKg: null,
            phone: null, address: null,
            insurance: { provider: null, memberId: null, groupId: null },
        },
        emergencyContacts: [],
        allergies: [],
        conditions: [],
        medications: [],
        immunizations: [],
        procedures: [],
        vitals: [],
        documents: [],
    };
}

// Assign + encrypt a full PHI payload.
medicalRecordSchema.methods.setPHI = function setPHI(phi) {
    this.encryptedData = encryptJSON(phi);
    this.updatedAt = Date.now();
};

// Decrypt and return the plain PHI payload (in memory only).
medicalRecordSchema.methods.decrypted = function decrypted() {
    const phi = decryptJSON(this.encryptedData);
    // Merge onto the canonical shape so older records gain new fields.
    return { ...emptyPHI(), ...phi };
};

// Derive the flat arrays the AI triage prompt expects. Keeps gemini.js unchanged.
medicalRecordSchema.methods.toTriageProfile = function toTriageProfile() {
    const phi = this.decrypted();
    return {
        allergies: (phi.allergies || []).map(a =>
            [a.substance, a.severity && `(${a.severity})`].filter(Boolean).join(' ')),
        conditions: (phi.conditions || [])
            .filter(c => c.status !== 'resolved')
            .map(c => c.name),
        medications: (phi.medications || [])
            .filter(m => m.active !== false)
            .map(m => [m.name, m.dose].filter(Boolean).join(' ')),
    };
};

export const MEDICAL_RECORD_SCHEMA_VERSION = SCHEMA_VERSION;
export default mongoose.models.MedicalRecord || mongoose.model('MedicalRecord', medicalRecordSchema);
