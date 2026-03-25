import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Get current user data
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-passwordHash');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user: { id: user._id, name: user.name, email: user.email, joinedAt: user.joinedAt } });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: trimmedEmail });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const newUser = new User({ name: name.trim(), email: trimmedEmail, passwordHash });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('[REGISTER] Error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find user
        const user = await User.findOne({ email: email.trim().toLowerCase() });

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (!process.env.JWT_SECRET) {
            console.error('[LOGIN] CRITICAL: JWT_SECRET is missing from environment variables.');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Generate JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, joinedAt: user.joinedAt }
        });
    } catch (error) {
        console.error('[LOGIN] Error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
