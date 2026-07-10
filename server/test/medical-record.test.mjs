import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import MedicalRecord, { emptyPHI } from '../models/MedicalRecord.js';

// These run against in-memory Mongoose documents — no DB connection required.

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439012';

function recordWithPHI(userId, mutate) {
    const rec = new MedicalRecord({ user: userId });
    const phi = emptyPHI();
    mutate(phi);
    rec.setPHI(phi);
    return rec;
}

test('setPHI stores only ciphertext — no plaintext PHI at rest', () => {
    const rec = recordWithPHI(USER_A, phi => {
        phi.allergies.push({ id: 'a1', substance: 'Penicillin', reaction: 'hives', severity: 'severe' });
        phi.medications.push({ id: 'm1', name: 'Albuterol', dose: '90mcg', active: true });
    });
    const stored = JSON.stringify(rec.encryptedData);
    assert.ok(rec.encryptedData.ciphertext && rec.encryptedData.iv && rec.encryptedData.tag);
    assert.ok(!stored.includes('Penicillin'));
    assert.ok(!stored.includes('Albuterol'));
});

test('decrypted() round-trips PHI and merges the canonical shape', () => {
    const rec = recordWithPHI(USER_A, phi => {
        phi.allergies.push({ id: 'a1', substance: 'Latex', reaction: null, severity: null });
    });
    const back = rec.decrypted();
    assert.equal(back.allergies[0].substance, 'Latex');
    assert.ok(Array.isArray(back.documents)); // canonical field present on older blobs
});

test('a blob swapped into another user record cannot be decrypted', () => {
    const recA = recordWithPHI(USER_A, phi => {
        phi.allergies.push({ id: 'a1', substance: 'Latex', reaction: null, severity: null });
    });
    const recB = new MedicalRecord({ user: USER_B });
    recB.encryptedData = recA.encryptedData; // attacker moves A's blob into B's row
    assert.throws(() => recB.decrypted());
});

test('toTriageProfile derives allergy severity and excludes resolved/inactive', () => {
    const rec = recordWithPHI(USER_A, phi => {
        phi.allergies.push({ id: 'a1', substance: 'Penicillin', severity: 'severe' });
        phi.conditions.push({ id: 'c1', name: 'Asthma', status: 'chronic' });
        phi.conditions.push({ id: 'c2', name: 'Old fracture', status: 'resolved' });
        phi.medications.push({ id: 'm1', name: 'Albuterol', dose: '90mcg', active: true });
        phi.medications.push({ id: 'm2', name: 'Stopped drug', active: false });
    });
    const triage = rec.toTriageProfile();
    assert.deepEqual(triage.allergies, ['Penicillin (severe)']);
    assert.deepEqual(triage.conditions, ['Asthma']);
    assert.deepEqual(triage.medications, ['Albuterol 90mcg']);
});
