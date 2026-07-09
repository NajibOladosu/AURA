// Offline verification of the EMR encryption + model layer.
// Runs without a database — exercises crypto and the MedicalRecord model's
// in-memory encrypt/decrypt/derive logic, and asserts the security invariant
// that only ciphertext (never plaintext PHI) is persisted.
//
//   node server/scripts/verify-emr.mjs
//
// If EMR_ENCRYPTION_KEY is unset, an ephemeral key is generated for the run.

import crypto from 'crypto';

if (!process.env.EMR_ENCRYPTION_KEY) {
    process.env.EMR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    console.log('• Using an ephemeral EMR_ENCRYPTION_KEY for this run.');
}

const { encryptJSON, decryptJSON } = await import('../lib/crypto.js');
const MedicalRecordModule = await import('../models/MedicalRecord.js');
const MedicalRecord = MedicalRecordModule.default;
const { emptyPHI } = MedicalRecordModule;

let failures = 0;
function check(name, cond) {
    if (cond) { console.log(`  ✓ ${name}`); }
    else { console.error(`  ✗ ${name}`); failures++; }
}

console.log('\n[1] crypto round-trip + AAD binding');
{
    const payload = encryptJSON({ secret: 'PENICILLIN-ALLERGY' }, 'user-A');
    check('ciphertext is not plaintext', !JSON.stringify(payload).includes('PENICILLIN'));
    check('decrypt with same AAD returns data', decryptJSON(payload, 'user-A').secret === 'PENICILLIN-ALLERGY');
    let blocked = false;
    try { decryptJSON(payload, 'user-B'); } catch { blocked = true; }
    check('decrypt with wrong AAD is rejected (blob-swap blocked)', blocked);
    let tamperBlocked = false;
    try { decryptJSON({ ...payload, ciphertext: Buffer.from('x').toString('base64') }, 'user-A'); } catch { tamperBlocked = true; }
    check('tampered ciphertext is rejected', tamperBlocked);
}

console.log('\n[2] MedicalRecord model encrypts PHI at rest');
{
    const userId = '507f1f77bcf86cd799439011';
    const rec = new MedicalRecord({ user: userId });
    const phi = emptyPHI();
    phi.allergies.push({ id: 'a1', substance: 'Penicillin', reaction: 'hives', severity: 'severe' });
    phi.conditions.push({ id: 'c1', name: 'Asthma', status: 'chronic', diagnosedDate: null, notes: null });
    phi.conditions.push({ id: 'c2', name: 'Old fracture', status: 'resolved', diagnosedDate: null, notes: null });
    phi.medications.push({ id: 'm1', name: 'Albuterol', dose: '90mcg', frequency: 'PRN', route: null, startDate: null, active: true });
    phi.medications.push({ id: 'm2', name: 'Stopped drug', dose: null, frequency: null, route: null, startDate: null, active: false });
    rec.setPHI(phi);

    const stored = JSON.stringify(rec.encryptedData);
    check('stored blob has ciphertext/iv/tag', !!(rec.encryptedData.ciphertext && rec.encryptedData.iv && rec.encryptedData.tag));
    check('stored blob contains NO plaintext PHI', !stored.includes('Penicillin') && !stored.includes('Asthma') && !stored.includes('Albuterol'));

    const back = rec.decrypted();
    check('decrypted allergy round-trips', back.allergies[0].substance === 'Penicillin');
    check('decrypted merges canonical shape (documents array present)', Array.isArray(back.documents));

    const triage = rec.toTriageProfile();
    check('triage derives allergy string with severity', triage.allergies[0] === 'Penicillin (severe)');
    check('triage excludes resolved conditions', triage.conditions.length === 1 && triage.conditions[0] === 'Asthma');
    check('triage excludes inactive medications', triage.medications.length === 1 && triage.medications[0] === 'Albuterol 90mcg');
}

console.log('\n[3] cross-user blob substitution via the model is rejected');
{
    const recA = new MedicalRecord({ user: '507f1f77bcf86cd799439011' });
    recA.setPHI({ ...emptyPHI(), allergies: [{ id: 'a1', substance: 'Latex', reaction: null, severity: null }] });
    const recB = new MedicalRecord({ user: '507f1f77bcf86cd799439012' });
    recB.encryptedData = recA.encryptedData; // attacker swaps A's blob into B's row
    let rejected = false;
    try { recB.decrypted(); } catch { rejected = true; }
    check("victim's record cannot decrypt the swapped blob", rejected);
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
