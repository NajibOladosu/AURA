import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth.js';
import MedicalRecord, { emptyPHI } from '../models/MedicalRecord.js';
import Profile from '../models/Profile.js';
import { recordAudit } from '../models/AuditLog.js';
import AuditLog from '../models/AuditLog.js';

const router = express.Router();

// ---- EMR access guard (short-lived re-auth token) --------------------------
// Sensitive reads require an `X-EMR-Access` JWT minted by POST /api/auth/reauth.
const emrAccessGuard = (req, res, next) => {
    const token = req.header('X-EMR-Access');
    if (!token) {
        return res.status(403).json({ error: 'EMR access requires re-authentication', code: 'REAUTH_REQUIRED' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.scope !== 'emr' || decoded.id !== req.user.id) {
            return res.status(403).json({ error: 'Invalid EMR access token', code: 'REAUTH_REQUIRED' });
        }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'EMR access token expired', code: 'REAUTH_REQUIRED' });
    }
};

// Load the record, creating + migrating from the legacy Profile on first access.
async function loadOrCreateRecord(userId) {
    let record = await MedicalRecord.findOne({ user: userId });
    if (record) return record;

    const phi = emptyPHI();

    // One-time migration from the old three-array Profile.
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

function newId() {
    return crypto.randomBytes(8).toString('hex');
}

// ---- Routes ----------------------------------------------------------------

// Full decrypted record — requires re-auth.
router.get('/', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        recordAudit({ user: req.user.id, action: 'read', req });
        res.json({
            schemaVersion: record.schemaVersion,
            updatedAt: record.updatedAt,
            createdAt: record.createdAt,
            record: record.decrypted(),
        });
    } catch (error) {
        console.error('[EMR] GET error:', error.message);
        res.status(500).json({ error: 'Server error fetching medical record' });
    }
});

// Patch one or more sections. Documents are managed via dedicated routes.
const SECTIONS = ['demographics', 'emergencyContacts', 'allergies', 'conditions', 'medications', 'immunizations', 'procedures'];

router.put('/', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();

        for (const section of SECTIONS) {
            if (req.body[section] === undefined) continue;
            if (section === 'demographics') {
                phi.demographics = { ...phi.demographics, ...req.body.demographics };
            } else if (Array.isArray(req.body[section])) {
                // Ensure every item has an id.
                phi[section] = req.body[section].map(item => ({ id: item.id || newId(), ...item }));
            }
        }

        record.setPHI(phi);
        await record.save();
        recordAudit({ user: req.user.id, action: 'write', req });
        res.json({ updatedAt: record.updatedAt, record: phi });
    } catch (error) {
        console.error('[EMR] PUT error:', error.message);
        res.status(500).json({ error: 'Server error updating medical record' });
    }
});

// Append a vital measurement.
router.post('/vitals', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const { type, value, unit, measuredAt } = req.body;
        if (!type || value === undefined) {
            return res.status(400).json({ error: 'type and value are required' });
        }
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();
        const vital = { id: newId(), type, value, unit: unit || null, measuredAt: measuredAt || Date.now() };
        phi.vitals.push(vital);
        record.setPHI(phi);
        await record.save();
        recordAudit({ user: req.user.id, action: 'write', resource: 'vitals', req });
        res.status(201).json(vital);
    } catch (error) {
        console.error('[EMR] POST vitals error:', error.message);
        res.status(500).json({ error: 'Server error adding vital' });
    }
});

router.delete('/vitals/:id', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();
        const before = phi.vitals.length;
        phi.vitals = phi.vitals.filter(v => v.id !== req.params.id);
        if (phi.vitals.length === before) return res.status(404).json({ error: 'Vital not found' });
        record.setPHI(phi);
        await record.save();
        recordAudit({ user: req.user.id, action: 'write', resource: 'vitals', req });
        res.json({ ok: true });
    } catch (error) {
        console.error('[EMR] DELETE vital error:', error.message);
        res.status(500).json({ error: 'Server error deleting vital' });
    }
});

// Upload an encrypted document (base64 in body).
router.post('/documents', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const { filename, mimeType, category, data } = req.body;
        if (!filename || !data) {
            return res.status(400).json({ error: 'filename and data are required' });
        }
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();
        const doc = {
            id: newId(),
            filename,
            mimeType: mimeType || 'application/octet-stream',
            category: ['lab', 'imaging', 'note', 'other'].includes(category) ? category : 'other',
            uploadedAt: Date.now(),
            data, // base64; encrypted at rest as part of the blob
        };
        phi.documents.push(doc);
        record.setPHI(phi);
        await record.save();
        recordAudit({ user: req.user.id, action: 'write', resource: 'document', req });
        // Return metadata only, not the bytes.
        const { data: _omit, ...meta } = doc;
        res.status(201).json(meta);
    } catch (error) {
        console.error('[EMR] POST document error:', error.message);
        res.status(500).json({ error: 'Server error uploading document' });
    }
});

// Fetch a single document's bytes.
router.get('/documents/:id', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();
        const doc = phi.documents.find(d => d.id === req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        recordAudit({ user: req.user.id, action: 'document_access', resource: `document:${doc.id}`, req });
        res.json(doc);
    } catch (error) {
        console.error('[EMR] GET document error:', error.message);
        res.status(500).json({ error: 'Server error fetching document' });
    }
});

router.delete('/documents/:id', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        const phi = record.decrypted();
        const before = phi.documents.length;
        phi.documents = phi.documents.filter(d => d.id !== req.params.id);
        if (phi.documents.length === before) return res.status(404).json({ error: 'Document not found' });
        record.setPHI(phi);
        await record.save();
        recordAudit({ user: req.user.id, action: 'write', resource: 'document', req });
        res.json({ ok: true });
    } catch (error) {
        console.error('[EMR] DELETE document error:', error.message);
        res.status(500).json({ error: 'Server error deleting document' });
    }
});

// Full JSON export — the patient owns their data.
router.get('/export', authMiddleware, emrAccessGuard, async (req, res) => {
    try {
        const record = await loadOrCreateRecord(req.user.id);
        recordAudit({ user: req.user.id, action: 'export', req });
        res.setHeader('Content-Disposition', 'attachment; filename="aura-medical-record.json"');
        res.json({ exportedAt: Date.now(), schemaVersion: record.schemaVersion, record: record.decrypted() });
    } catch (error) {
        console.error('[EMR] export error:', error.message);
        res.status(500).json({ error: 'Server error exporting record' });
    }
});

// Patient's own access history.
router.get('/audit', authMiddleware, async (req, res) => {
    try {
        const logs = await AuditLog.find({ user: req.user.id }).sort({ at: -1 }).limit(200).lean();
        res.json(logs.map(l => ({ action: l.action, resource: l.resource, ip: l.ip, at: l.at })));
    } catch (error) {
        console.error('[EMR] audit error:', error.message);
        res.status(500).json({ error: 'Server error fetching audit log' });
    }
});

export default router;
