import jwt from 'jsonwebtoken';

// Middleware to protect routes
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded; // Adds user {id: ...} to request
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export default authMiddleware;
