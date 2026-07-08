import express from 'express';
import crypto from 'crypto';
import authMiddleware from '../middleware/auth.js';
import MedicalRecord, { emptyPHI } from '../models/MedicalRecord.js';
import Profile from '../models/Profile.js';

const router = express.Router();

// Backward-compatibility shim. The old profile was three string arrays; the app
// and AI triage still speak that shape. This now reads/writes those arrays from
// the encrypted MedicalRecord so there is a single source of truth. It only
// surfaces the flat clinical names (not full PHI), so it does not require the
// EMR re-auth token — the rich record lives behind /api/emr.

function newId() {
    return crypto.randomBytes(8).toString('hex');
}

async function loadOrCreateRecord(userId) {
    let record = await MedicalRecord.findOne({ user: userId });
    if (record) return record;

    const phi = emptyPHI();
    const legacy = await Profile.findOne({ user: userId });
    if (legacy) {
        phi.allergies = (legacy.allergies || []).map(s => ({ id: newId(), substance: s, reaction: null, severity: null }));
        phi.conditions = (legacy.conditions || []).map(s => ({ id: newId(), name: s, status: 'active', diagnosedDate: null, notes: null }));
        phi.medications = (legacy.medications || []).map(s => ({ id: newId(), name: s, dose: null, frequency: null, route: null, startDate: null, active: true }));
    }
    record = new MedicalRecord({ user: userId });
    record.setPHI(phi);
    await record.save();
    return record;
}

function toFlat(phi) {
    return {
        allergies: (phi.allergies || []).map(a => a.substance).filter(Boolean),
        conditions: (phi.conditions || []).map(c => c.name).filter(Boolean),
        medications: (phi.medications || []).map(m => m.name).filter(Boolean),
    };
}

// Get flat profile.
router.get('/', authMiddleware, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        res.json(toFlat(record.decrypted()));
    } catch (error) {
        console.error('[PROFILE] GET error:', error.message);
        res.status(500).json({ error: 'Server error fetching profile' });
    }
});

// Update flat profile. Merges names into structured lists, preserving existing
// structured detail (dose, severity, status) for entries whose name is unchanged.
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { allergies, conditions, medications } = req.body;
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();

        if (Array.isArray(allergies)) {
            const existing = new Map(phi.allergies.map(a => [a.substance, a]));
            phi.allergies = allergies.map(s => existing.get(s) || { id: newId(), substance: s, reaction: null, severity: null });
        }
        if (Array.isArray(conditions)) {
            const existing = new Map(phi.conditions.map(c => [c.name, c]));
            phi.conditions = conditions.map(s => existing.get(s) || { id: newId(), name: s, status: 'active', diagnosedDate: null, notes: null });
        }
        if (Array.isArray(medications)) {
            const existing = new Map(phi.medications.map(m => [m.name, m]));
            phi.medications = medications.map(s => existing.get(s) || { id: newId(), name: s, dose: null, frequency: null, route: null, startDate: null, active: true });
        }

        record.setPHI(phi);
        await record.save();
        res.json(toFlat(phi));
    } catch (error) {
        console.error('[PROFILE] POST error:', error.message);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

export default router;
