import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import historyRoutes from './routes/history.js';
import geminiRoutes from './routes/gemini.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', geminiRoutes);

// Database connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;

    // Disable buffering for serverless environments to avoid timeout headaches
    mongoose.set('bufferCommands', false);

    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error("CRITICAL: MONGO_URI is missing from environment variables.");
            return;
        }

        // Diagnostic log (Masked for safety)
        const maskedUri = uri.replace(/:([^@]+)@/, ":****@");
        console.log(`Attempting to connect to MongoDB with URI: ${maskedUri}`);

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000, // Timeout after 8s
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000,
        });
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        console.error('MongoDB Connection Error:', {
            message: error.message,
            code: error.code,
            name: error.name
        });
    }
};

// Middleware to ensure DB connection on every request (useful for serverless)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

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
