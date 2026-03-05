import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    joinedAt: { type: Number, default: () => Date.now() }
});

export default mongoose.model('User', userSchema);
