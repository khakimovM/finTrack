# Security rules

## Authentication
- Passwords: bcrypt, cost factor 12. Never log, never return, never store in plain text.
- Access token: 15 min, `httpOnly` + `secure` (prod) + `sameSite=lax` cookie.
- Refresh token: 7 days, stored **hashed** in the `RefreshToken` table, rotated on every use.
  Reuse of an already-rotated token invalidates the whole family and forces re-login.
- Logout clears cookies and revokes the stored refresh token. `logout-all` revokes every
  session for that user.
- Login failures return one generic message. Never reveal whether the email exists.

## Authorisation
- Ownership check on every single resource read and write, in the repository layer.
- A resource owned by someone else returns **404**, not 403 — do not leak existence.
- No client-supplied `userId`, ever. It comes from the verified token only.

## Input
- Everything crossing the boundary is Zod-validated: body, query, params.
- Reject unknown keys (`.strict()`) on write schemas.
- `limit` is capped server-side at 100 regardless of what the client asks for.

## Transport & headers
- Helmet enabled. CORS restricted to `CLIENT_URL` with `credentials: true`. No wildcard.
- CSRF: `sameSite=lax` cookies plus an `X-Requested-With` check on state-changing routes.
- Throttler: 5/min on `/auth/login`, `/auth/register`, `/auth/forgot-password`.

## Secrets
- Never commit `.env`. Never hardcode a secret, key, or connection string in source.
- `.env.example` holds placeholder values only.
- Boot fails if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is missing or shorter than 32 chars.

## Data exposure
- Never return `passwordHash`, token hashes, or another user's `personName` data.
- Error responses carry a code and a human message — never a stack trace in production.
- Structured logs must not contain tokens, cookies, or password fields.
