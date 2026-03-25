import jwt from 'jsonwebtoken';

// Middleware to protect routes
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export default authMiddleware;
