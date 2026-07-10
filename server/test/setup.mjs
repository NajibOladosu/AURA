// Shared test bootstrap: deterministic-but-ephemeral keys so suites never touch
// real secrets. Imported for side effects before any module that reads env.
import crypto from 'crypto';

if (!process.env.EMR_ENCRYPTION_KEY) {
    process.env.EMR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
}
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-' + crypto.randomBytes(8).toString('hex');
}
