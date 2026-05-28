# Auth Testing Playbook (Emergent Google OAuth)

This document is for the testing agent. The RIVITED app supports TWO sign-in paths:

## 1) Existing JWT Email/Password (preserved)
- Demo accounts: see `/app/memory/test_credentials.md`
- Endpoint: `POST /api/auth/login` with `{email, password}` → sets `access_token` + `refresh_token` httpOnly cookies
- Optional MFA: if `mfa_enabled=true`, login returns `{mfa_required: true, mfa_token: "...", user_id: "..."}` and the client must POST `/api/auth/mfa/verify` with `{mfa_token, code}` to complete login

## 2) Emergent-managed Google OAuth (new)
Flow:
1. Frontend redirects to `https://auth.emergentagent.com/?redirect=<window.location.origin>/dashboard`
2. User completes Google login on Emergent
3. Emergent redirects back to `<origin>/dashboard#session_id=XXX`
4. Frontend `AuthCallback` extracts `session_id` from URL fragment, POSTs to backend
5. Backend `POST /api/auth/google/session` calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with `X-Session-ID: <session_id>`
6. Backend finds-or-creates user in `users` collection, defaults role to `investor` for new users
7. Backend mints same JWT cookies (`access_token`, `refresh_token`) so the rest of the app works identically

## Backend testing without going through Google
For testing flows that require a Google session, you can directly create a user in MongoDB and mint a JWT bypassing OAuth. But preferred: use the seeded demo users (producer/investor/distributor/admin).

## Key fields
- `users` collection: `_id` (ObjectId), `email`, `name`, `role`, `password_hash` (optional for OAuth users), `mfa_secret` (TOTP base32), `mfa_enabled` (bool), `auth_provider` ("password" | "google"), `created_at`
- Cookies set: `access_token` (12h), `refresh_token` (7d) — httpOnly, samesite=none, secure=true
