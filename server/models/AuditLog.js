import mongoose from 'mongoose';

// Append-only audit trail for PHI access. No update/delete routes exist for
// this collection — records are immutable by convention.
const auditLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
        type: String,
        required: true,
        enum: ['read', 'write', 'export', 'document_access', 'reauth'],
    },
    resource: { type: String, default: 'medical_record' },
    ip: { type: String },
    userAgent: { type: String },
    at: { type: Number, default: () => Date.now() },
}, { bufferCommands: false });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// Fire-and-forget helper; never let audit failures break the main request.
export async function recordAudit({ user, action, resource, req }) {
    try {
        const Model = mongoose.models.AuditLog || mongoose.model('AuditLog');
        await Model.create({
            user,
            action,
            resource: resource || 'medical_record',
            ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip,
            userAgent: req?.headers?.['user-agent'],
        });
    } catch (err) {
        console.error('[AUDIT] Failed to write audit log:', err.message);
    }
}
