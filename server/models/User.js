import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    joinedAt: { type: Number, default: () => Date.now() }
}, { bufferCommands: false });

export default mongoose.models.User || mongoose.model('User', userSchema);
