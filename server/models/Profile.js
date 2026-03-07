import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    allergies: [{ type: String }],
    conditions: [{ type: String }],
    medications: [{ type: String }]
}, { bufferCommands: false });

export default mongoose.models.Profile || mongoose.model('Profile', profileSchema);
