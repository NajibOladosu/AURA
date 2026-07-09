import crypto from 'crypto';

// AES-256-GCM application-level field encryption for PHI.
// The key is a base64-encoded 32-byte value in EMR_ENCRYPTION_KEY.
// A keyId is stored alongside each ciphertext so keys can be rotated later
// without breaking previously-encrypted rows.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const CURRENT_KEY_ID = 'k1';

let cachedKey = null;

function loadKey() {
    if (cachedKey) return cachedKey;

    const raw = process.env.EMR_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error(
            'EMR_ENCRYPTION_KEY is missing. Generate one with:\n' +
            '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
        );
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        throw new Error(`EMR_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}.`);
    }

    cachedKey = { [CURRENT_KEY_ID]: key };
    return cachedKey;
}

function keyFor(keyId) {
    const keys = loadKey();
    const key = keys[keyId];
    if (!key) throw new Error(`Unknown encryption keyId: ${keyId}`);
    return key;
}

// Fail fast at startup if the key is absent or malformed.
export function assertEncryptionReady() {
    loadKey();
}

// `aad` (Additional Authenticated Data) binds the ciphertext to a context —
// e.g. the owning user id. GCM authenticates but does not encrypt the AAD, so
// a blob encrypted for one user cannot be swapped into another user's record:
// decrypt fails unless the same AAD is supplied.
export function encrypt(plaintext, aad) {
    if (typeof plaintext !== 'string') {
        throw new Error('encrypt() expects a string');
    }
    const key = keyFor(CURRENT_KEY_ID);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    if (aad != null) cipher.setAAD(Buffer.from(String(aad), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        keyId: CURRENT_KEY_ID,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    };
}

export function decrypt(payload, aad) {
    if (!payload || !payload.iv || !payload.tag || !payload.ciphertext) {
        throw new Error('decrypt() received a malformed payload');
    }
    const key = keyFor(payload.keyId || CURRENT_KEY_ID);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
    if (aad != null) decipher.setAAD(Buffer.from(String(aad), 'utf8'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, 'base64')),
        decipher.final(),
    ]);
    return plaintext.toString('utf8');
}

// Convenience helpers for encrypting a JSON-serializable object.
export function encryptJSON(obj, aad) {
    return encrypt(JSON.stringify(obj), aad);
}

export function decryptJSON(payload, aad) {
    return JSON.parse(decrypt(payload, aad));
}
