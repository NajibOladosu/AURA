import express from 'express';
import jwt from 'jsonwebtoken';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import User from '../models/User.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_EVENTS = ['page_view', 'triage_completed', 'account_registered', 'guest_converted'];

// ─── Admin auth middleware ────────────────────────────────────────────────────

const requireAdmin = async (req, res, next) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        return res.status(503).json({ error: 'Admin access not configured' });
    }

    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('email').lean();
        if (!user || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ─── POST /api/analytics/event ───────────────────────────────────────────────
// Open to all. Always returns 204 — analytics must never surface errors to UI.

router.post('/event', async (req, res) => {
    try {
        const { event, visitorId, isAuthenticated } = req.body;

        if (!event || !VALID_EVENTS.includes(event) || !visitorId || !UUID_RE.test(visitorId)) {
            return res.status(204).end();
        }

        await AnalyticsEvent.create({
            event,
            visitorId,
            isAuthenticated: Boolean(isAuthenticated),
            ts: Date.now()
        });
    } catch (err) {
        console.error('[Analytics] Ingest error:', err.message);
    }
    res.status(204).end();
});

// ─── GET /api/analytics/stats ────────────────────────────────────────────────
// Admin only.

router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        const [
            allVisitorIds,
            guestTriages,
            authTriages,
            registrations,
            convertedVisitorIds,
            dauVisitorIds,
            wauVisitorIds,
            guestTriageVisitorIds,
            dailyTriage7d,
            dailyReg7d
        ] = await Promise.all([
            AnalyticsEvent.distinct('visitorId'),
            AnalyticsEvent.countDocuments({ event: 'triage_completed', isAuthenticated: false }),
            AnalyticsEvent.countDocuments({ event: 'triage_completed', isAuthenticated: true }),
            AnalyticsEvent.countDocuments({ event: 'account_registered' }),
            AnalyticsEvent.distinct('visitorId', { event: 'guest_converted' }),
            AnalyticsEvent.distinct('visitorId', { ts: { $gte: now - day } }),
            AnalyticsEvent.distinct('visitorId', { ts: { $gte: now - 7 * day } }),
            AnalyticsEvent.distinct('visitorId', { event: 'triage_completed', isAuthenticated: false }),
            AnalyticsEvent.aggregate([
                { $match: { event: 'triage_completed', ts: { $gte: now - 7 * day } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$ts' } } },
                        count: { $sum: 1 },
                        guestCount: { $sum: { $cond: [{ $eq: ['$isAuthenticated', false] }, 1, 0] } },
                        authCount: { $sum: { $cond: [{ $eq: ['$isAuthenticated', true] }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            AnalyticsEvent.aggregate([
                { $match: { event: 'account_registered', ts: { $gte: now - 7 * day } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$ts' } } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        const guestTriageVisitors = guestTriageVisitorIds.length;
        const converted = convertedVisitorIds.length;
        const conversionRate = guestTriageVisitors > 0
            ? ((converted / guestTriageVisitors) * 100).toFixed(1)
            : '0.0';

        res.json({
            generatedAt: new Date().toISOString(),
            overview: {
                totalUniqueVisitors: allVisitorIds.length,
                dau: dauVisitorIds.length,
                wau: wauVisitorIds.length
            },
            triages: {
                guest: guestTriages,
                authenticated: authTriages,
                total: guestTriages + authTriages
            },
            registrations: {
                total: registrations
            },
            conversion: {
                guestTriageVisitors,
                converted,
                ratePercent: conversionRate
            },
            timeSeries: {
                triages7d: dailyTriage7d,
                registrations7d: dailyReg7d
            }
        });
    } catch (err) {
        console.error('[Analytics] Stats error:', err.message);
        res.status(500).json({ error: 'Failed to compute stats' });
    }
});

export default router;
