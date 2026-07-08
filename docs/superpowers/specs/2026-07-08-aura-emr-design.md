# AURA EMR — Secure Patient Medical Record

**Date:** 2026-07-08
**Status:** Approved
**Scope:** Upgrade the thin `Profile` (three string arrays) into an EMR-grade, encrypted, patient-owned medical record, integrated into the existing AURA app without breaking AI triage.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Access model | **Patient-owned only** — single user owns/edits their own record. No clinician RBAC. |
| Record scope | Demographics + contacts, Clinical lists, Vitals + measurements, Documents + labs |
| Encryption | **App-level AES-256-GCM** field encryption; server-held key; server decrypts in memory for triage |
| Security controls | Audit log, re-auth for sensitive view, session hardening. **MFA deferred.** |
| Document storage | **Encrypted in MongoDB** (base64 bytes in the encrypted blob) |

## Non-goals

- No clinician / multi-user / multi-tenant access.
- No zero-knowledge E2E (would break AI triage).
- No external blob storage.
- No MFA yet (schema leaves room via `user.mfaEnabled`).

## Architecture

### Data model — `MedicalRecord` (one per user)

Only non-PHI metadata is stored in cleartext; all PHI lives inside a single encrypted blob field.

Cleartext columns: `user` (ObjectId, unique), `schemaVersion`, `createdAt`, `updatedAt`, `encryptedData` (`{ keyId, iv, tag, ciphertext }`).

Decrypted PHI payload shape:

- **demographics**: `dob`, `sex`, `bloodType`, `heightCm`, `weightKg`, `phone`, `address`, `insurance { provider, memberId, groupId }`
- **emergencyContacts[]**: `id`, `name`, `relationship`, `phone`
- **allergies[]**: `id`, `substance`, `reaction`, `severity` (`mild|moderate|severe|life-threatening`)
- **conditions[]**: `id`, `name`, `status` (`active|resolved|chronic`), `diagnosedDate`, `notes`
- **medications[]**: `id`, `name`, `dose`, `frequency`, `route`, `startDate`, `active`
- **immunizations[]**: `id`, `vaccine`, `date`, `notes`
- **procedures[]**: `id`, `name`, `date`, `notes`
- **vitals[]**: `id`, `type` (`bp|hr|temp|glucose|spo2|weight`), `value`, `unit`, `measuredAt`
- **documents[]**: `id`, `filename`, `mimeType`, `category` (`lab|imaging|note|other`), `uploadedAt`, `data` (base64, encrypted with the rest of the blob)

### Encryption — `server/lib/crypto.js`

- `encrypt(plaintextString) -> { keyId, iv, tag, ciphertext }` using AES-256-GCM.
- `decrypt({ keyId, iv, tag, ciphertext }) -> plaintextString`.
- Key from `EMR_ENCRYPTION_KEY` env var (base64-encoded 32 bytes). `keyId` stored with ciphertext to support future key rotation.
- Model helpers: `record.setPHI(obj)` encrypts + assigns; `record.decrypted()` returns the plain payload. Server sees plaintext only in memory.

### API — `server/routes/emr.js`, mounted at `/api/emr`, all behind `authMiddleware`

- `GET /` — full decrypted record. **Requires `X-EMR-Access` re-auth token.** Auto-creates + migrates from legacy `Profile` on first load.
- `PUT /` — patch one or more sections.
- `POST /vitals`, `DELETE /vitals/:id` — time-series append/remove.
- `POST /documents`, `GET /documents/:id`, `DELETE /documents/:id` — encrypted attachments (base64 in body).
- `GET /export` — full JSON export (patient owns their data).
- `GET /audit` — patient's own access history.

Legacy `/api/profile` kept as a **compat shim** that reads/writes the EMR's flat clinical arrays, so existing client code and triage keep working. Triage in `gemini.js` is unchanged — the server derives `{allergies, conditions, medications}` string arrays from structured data.

### Audit log — `server/models/AuditLog.js`

Append-only: `{ user, action (read|write|export|document_access|reauth), resource, ip, userAgent, at }`. No update/delete routes → immutable. Written on every EMR route.

### Re-auth + session hardening

- `POST /api/auth/reauth` — verify current password → issue short-lived (5 min) `emr_access` JWT (`scope: 'emr'`). `GET /api/emr` requires it via `X-EMR-Access`.
- Login JWT expiry cut 7d → **1d**. `authMiddleware` unchanged otherwise.

### Client — `App.tsx` + `components/emr/`

- Rich EMR view (section cards: Demographics, Allergies, Conditions, Medications, Vitals w/ trend, Documents, Audit) replacing the thin profile page.
- Re-auth modal (password) before opening EMR; `emr_access` token held **in memory only** (never localStorage).
- New TS interfaces in `lib/types.ts` (`MedicalRecord` + subtypes). `UserProfile` kept as the derived flat shape for triage.

## Testing / verification

No test runner exists. Add `server/scripts/verify-emr.mjs` that:
1. round-trips `encrypt` → `decrypt`,
2. confirms a saved record stores only ciphertext in Mongo (no plaintext PHI),
3. exercises audit logging.

Then manual dogfood of the UI flow.

## Security notes

- `EMR_ENCRYPTION_KEY` is a new **required** env var (32 bytes, base64). Missing key → server refuses to start. Documented in `.env` example + CLAUDE.md.
- Losing the key = unrecoverable PHI. Backup separately from the DB.
- Cutting JWT to 1d logs out existing sessions once.

## Commit plan (one per significant step)

1. Design spec (this doc)
2. `crypto.js`
3. `MedicalRecord` + `AuditLog` models
4. EMR routes + reauth endpoint
5. Server wiring + profile compat shim + env + JWT hardening
6. Client types + EMR UI + reauth modal
7. Verify script + docs
