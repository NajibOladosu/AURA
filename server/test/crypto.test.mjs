import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, encryptJSON, decryptJSON } from '../lib/crypto.js';

test('round-trips a PHI string through encrypt/decrypt', () => {
    const payload = encrypt('PENICILLIN-ALLERGY', 'user-A');
    assert.equal(decrypt(payload, 'user-A'), 'PENICILLIN-ALLERGY');
});

test('never emits plaintext in the stored blob', () => {
    const blob = JSON.stringify(encryptJSON({ substance: 'Penicillin' }, 'user-A'));
    assert.ok(!blob.includes('Penicillin'));
});

test('emits a fresh IV per call so identical inputs differ at rest', () => {
    const a = encrypt('same', 'user-A');
    const b = encrypt('same', 'user-A');
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
});

test('rejects decryption under a different AAD (blocks cross-account blob swap)', () => {
    const payload = encrypt('secret', 'user-A');
    assert.throws(() => decrypt(payload, 'user-B'));
});

test('rejects a tampered ciphertext (GCM auth tag)', () => {
    const payload = encrypt('secret', 'user-A');
    const forged = { ...payload, ciphertext: Buffer.from('evil').toString('base64') };
    assert.throws(() => decrypt(forged, 'user-A'));
});

test('rejects a tampered auth tag', () => {
    const payload = encrypt('secret', 'user-A');
    const forged = { ...payload, tag: Buffer.alloc(16, 1).toString('base64') };
    assert.throws(() => decrypt(forged, 'user-A'));
});

test('rejects a malformed payload missing required fields', () => {
    assert.throws(() => decrypt({ iv: 'x' }, 'user-A'), /malformed/);
});

test('rejects a non-string plaintext at encrypt', () => {
    assert.throws(() => encrypt({ not: 'a string' }, 'user-A'), /expects a string/);
});

test('encryptJSON/decryptJSON round-trips a nested object', () => {
    const obj = { allergies: [{ substance: 'Latex', severity: 'severe' }], count: 1 };
    assert.deepEqual(decryptJSON(encryptJSON(obj, 'user-A'), 'user-A'), obj);
});
