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
    try {
        if (!process.env.MONGO_URI) {
            console.warn("MONGO_URI is missing from .env. The server will start, but database connection will fail.");
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

// Start Server
app.listen(PORT, async () => {
    await connectDB();
    console.log(`Server running on port ${PORT}`);
});

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Aura Backend is running!' });
});
