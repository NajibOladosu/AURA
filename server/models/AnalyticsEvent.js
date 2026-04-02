import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema({
    event: {
        type: String,
        required: true,
        enum: ['page_view', 'triage_completed', 'account_registered', 'guest_converted'],
        index: true
    },
    visitorId: {
        type: String,
        required: true,
        index: true
    },
    isAuthenticated: {
        type: Boolean,
        required: true
    },
    ts: {
        type: Number,
        required: true,
        default: () => Date.now(),
        index: true
    }
}, {
    bufferCommands: false,
    collection: 'analyticsevents'
});

// Compound index for the most common stats query: events of type X in time range T
analyticsEventSchema.index({ event: 1, ts: -1 });

// TTL: auto-delete events older than 2 years (63072000 seconds)
analyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: 63072000 });

export default mongoose.models.AnalyticsEvent ||
    mongoose.model('AnalyticsEvent', analyticsEventSchema);
