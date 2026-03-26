import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Session from '../models/Session.js';

const router = express.Router();

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get all sessions for a user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const sessions = await Session.find({ user: req.user.id }).sort({ timestamp: -1 });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching sessions' });
    }
});

// Get a specific session
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid session ID' });

        const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching session' });
    }
});

// Create a new session
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { result, chatHistory, nearbyPlaces } = req.body;

        const newSession = new Session({
            user: req.user.id,
            result,
            chatHistory: chatHistory || [],
            nearbyPlaces: nearbyPlaces || []
        });

        await newSession.save();
        res.status(201).json(newSession);
    } catch (error) {
        res.status(500).json({ error: 'Server error creating session' });
    }
});

// Update a session (e.g., adding chat messages or places)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid session ID' });

        const { chatHistory, nearbyPlaces } = req.body;

        const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        if (chatHistory) session.chatHistory = chatHistory;
        if (nearbyPlaces) session.nearbyPlaces = nearbyPlaces;

        await session.save();
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: 'Server error updating session' });
    }
});

// Delete a session
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid session ID' });

        const session = await Session.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error deleting session' });
    }
});

export default router;
