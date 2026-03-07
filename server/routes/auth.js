import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const newUser = new User({ name, email, passwordHash });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[LOGIN] Attempt for: ${email}`);

        if (!process.env.MONGO_URI) {
            console.error("[LOGIN] CRITICAL: MONGO_URI is missing from environment variables.");
        }

        // Find user
        console.log(`[LOGIN] Querying database for user: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`[LOGIN] Failed: User not found (${email})`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Compare password
        console.log(`[LOGIN] User found, comparing password for: ${email}`);
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            console.log(`[LOGIN] Failed: Password mismatch (${email})`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        console.log(`[LOGIN] Success, generating token for: ${email}`);
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('[LOGIN] ERROR DETAIL:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            error: 'Server error',
            details: error.message,
            type: error.name
        });
    }
});

export default router;
