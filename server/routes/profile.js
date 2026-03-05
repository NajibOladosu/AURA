import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Profile from '../models/Profile.js';

const router = express.Router();

// Get user profile
router.get('/', authMiddleware, async (req, res) => {
    try {
        let profile = await Profile.findOne({ user: req.user.id });

        // If no profile exists, return a default empty one rather than an error
        if (!profile) {
            profile = { allergies: [], conditions: [], medications: [] };
        }

        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching profile' });
    }
});

// Update profile (replace entirely)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { allergies, conditions, medications } = req.body;

        let profile = await Profile.findOne({ user: req.user.id });

        if (profile) {
            // Update
            profile.allergies = allergies || profile.allergies;
            profile.conditions = conditions || profile.conditions;
            profile.medications = medications || profile.medications;
        } else {
            // Create
            profile = new Profile({
                user: req.user.id,
                allergies: allergies || [],
                conditions: conditions || [],
                medications: medications || []
            });
        }

        await profile.save();
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

export default router;
