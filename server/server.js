import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// Initialize configuration immediately
dotenv.config();
mongoose.set('bufferCommands', false);

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import historyRoutes from './routes/history.js';
import geminiRoutes from './routes/gemini.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Global connection caching for serverless
let cachedConnection = null;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return mongoose.connection;
    if (cachedConnection) return cachedConnection;

    mongoose.set('bufferCommands', false);

    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error("MONGO_URI is missing from environment variables.");
        }

        const maskedUri = uri.replace(/:([^@]+)@/, ":****@");
        console.log(`[DB] Connecting to: ${maskedUri}`);

        cachedConnection = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        await cachedConnection;
        console.log('[DB] Connected Successfully');
        return mongoose.connection;
    } catch (error) {
        cachedConnection = null;
        console.error('[DB] Connection Error:', error.message);
        throw error;
    }
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

// CRITICAL: Ensure DB is connected BEFORE any routes are handled
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Rate limiting for unauthenticated AI requests
const aiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please sign in or try again later.' },
    skip: (req) => {
        const token = req.header('Authorization')?.split(' ')[1];
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return true; // Authenticated users skip rate limit
            } catch { return false; }
        }
        return false;
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', aiRateLimiter, geminiRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Aura Backend is running!', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Start Server locally
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

export default app;
