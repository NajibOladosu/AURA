import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth.js';
import { emrAccessGuard } from '../routes/emr.js';

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439012';

// Minimal Express req/res doubles. res.status().json() records the outcome;
// next() flips a flag. Lets us drive the real guard logic without an HTTP server.
function makeReq(headers = {}, user = null) {
    return { user, header: (name) => headers[name] };
}
function makeRes() {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
}
function run(mw, req) {
    const res = makeRes();
    let passed = false;
    mw(req, res, () => { passed = true; });
    return { res, passed };
}

const sign = (payload, opts) => jwt.sign(payload, process.env.JWT_SECRET, opts);

// ---- authMiddleware --------------------------------------------------------

test('authMiddleware rejects a request with no token', () => {
    const { res, passed } = run(authMiddleware, makeReq({}));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
});

test('authMiddleware rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ id: USER_A }, 'not-the-real-secret');
    const { res, passed } = run(authMiddleware, makeReq({ Authorization: `Bearer ${forged}` }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
});

test('authMiddleware rejects an expired token', () => {
    const expired = sign({ id: USER_A }, { expiresIn: -10 });
    const { res, passed } = run(authMiddleware, makeReq({ Authorization: `Bearer ${expired}` }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
});

test('authMiddleware admits a valid token and populates req.user', () => {
    const token = sign({ id: USER_A }, { expiresIn: '1d' });
    const req = makeReq({ Authorization: `Bearer ${token}` });
    const { passed } = run(authMiddleware, req);
    assert.equal(passed, true);
    assert.equal(req.user.id, USER_A);
});

// ---- emrAccessGuard (X-EMR-Access re-auth token) ---------------------------

test('emrAccessGuard demands re-auth when the EMR token is absent', () => {
    const { res, passed } = run(emrAccessGuard, makeReq({}, { id: USER_A }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'REAUTH_REQUIRED');
});

test('emrAccessGuard rejects a plain login token (missing emr scope)', () => {
    const loginToken = sign({ id: USER_A }, { expiresIn: '1d' }); // no scope: 'emr'
    const { res, passed } = run(emrAccessGuard, makeReq({ 'X-EMR-Access': loginToken }, { id: USER_A }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
});

test('emrAccessGuard rejects another user\'s EMR token (cross-account)', () => {
    const tokenForB = sign({ id: USER_B, scope: 'emr' }, { expiresIn: '5m' });
    const { res, passed } = run(emrAccessGuard, makeReq({ 'X-EMR-Access': tokenForB }, { id: USER_A }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
});

test('emrAccessGuard rejects an expired EMR token', () => {
    const expired = sign({ id: USER_A, scope: 'emr' }, { expiresIn: -1 });
    const { res, passed } = run(emrAccessGuard, makeReq({ 'X-EMR-Access': expired }, { id: USER_A }));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
});

test('emrAccessGuard admits a valid, scoped, same-user EMR token', () => {
    const good = sign({ id: USER_A, scope: 'emr' }, { expiresIn: '5m' });
    const { passed } = run(emrAccessGuard, makeReq({ 'X-EMR-Access': good }, { id: USER_A }));
    assert.equal(passed, true);
});
