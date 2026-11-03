# Account deletion request intake

This version only collects verified requests and exposes their status to the separate Next.js repository at `D:/tutem-account-deletion`. Account deletion, ride cancellation, session revocation, and the admin queue are intentionally deferred.

## Backend setup

The mobile apps use the self-hosted backend at `https://tutem.civil.iitb.ac.in/app4` (Convex client/deployment API) and `https://tutem.civil.iitb.ac.in/app3` (public HTTP actions). The standalone frontend is now configured for the latter, rather than the local demo API.

Deployment is currently blocked because `CONVEX_SELF_HOSTED_ADMIN_KEY` is empty in `packages/api/.env.self-hosted.local`. That ignored local file must contain the backend's URL and valid admin key; do not put the key in the frontend or commit it. The live HTTP server is reachable, but `/api/account-deletion/status` currently returns 404 because the new routes have not been deployed.

After the key is supplied, check the existing deployment diff and deploy from `packages/api`:

```sh
yarn tsc -p convex/tsconfig.json --noEmit
yarn test:account-deletion
yarn convex deploy --dry-run --env-file .env.self-hosted.local --typecheck disable
yarn convex deploy --env-file .env.self-hosted.local --typecheck disable
```

The explicit Convex TypeScript check is used because the broader shared API check has unrelated pre-existing errors. Inspect the dry-run output before deployment; the account request changes only add the two intake tables, their indexes, and the request endpoints. No deployment or real SMS delivery has yet been verified.

Configure these variables **in Convex**, not in the public frontend:

- `SMS_URL` and `SMS_LICENSE`: the same gateway settings as existing login OTPs. The gateway's existing `registration_otp` template is reused, but deletion challenges are stored separately and never create a login session.
- `ACCOUNT_DELETION_ALLOWED_ORIGINS`: comma-separated frontend origins, including scheme and port. For local development: `http://127.0.0.1:3100,http://localhost:3100`. If omitted, CORS allows all origins. CORS is not authentication.

Set `NEXT_PUBLIC_ACCOUNT_DELETION_API_URL=https://tutem.civil.iitb.ac.in/app3` in the standalone frontend, then rebuild it. For a future Convex Cloud deployment, use its `https://…convex.site` HTTP base URL rather than its `convex.cloud` SDK URL.

## Public API

All endpoints use `POST` and JSON, with `OPTIONS` preflight support. Responses use `Cache-Control: no-store`. Phone numbers go in request bodies, never URLs.

| Path                           | Body                                                                 | Success                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/account-deletion/status` | `{ phoneNumber }`                                                    | `{ request: null }` or `{ request: { scope, status } }`                                                                                |
| `/api/account-deletion/otp`    | `{ phoneNumber, extend?: true }`                                     | `{ kind: "existing", request, remainingScope }` or `{ kind: "otp", challengeId, availableScope, expiresInSeconds, retryAfterSeconds }` |
| `/api/account-deletion/submit` | `{ phoneNumber, scope, challengeId, otp, confirmed: true, reason? }` | `{ request: { scope, status } }`                                                                                                       |

`scope`: `Rider`, `Driver`, or `Both`. `status`: `Requested` or `Deleted`.

Phone numbers normalize to ten Indian digits; `+91`, formatting spaces, parentheses, and hyphens are accepted. The optional reason is limited to 500 characters. The OTP endpoint looks up the shared user and actual rider/driver profile records before sending SMS. A number without either profile returns 404 and receives no code.

The frontend starts with only the phone number. An OTP response's `availableScope` determines the second screen: `Rider` or `Driver` is selected automatically with no picker; `Both` displays Rider/Driver/Both choices beside the OTP form. The code is bound to the available scope when issued, and submission also rechecks current profile registration. It cannot be used to request an unavailable profile.

Errors return `{ error, retryAfterSeconds? }`. Invalid input or code returns 400, a blocked origin 403, an unregistered number 404, an oversized body 413, an unsupported content type 415, throttling 429, and unavailable SMS delivery 503. Rate-limit responses include `Retry-After`.

Status lookup deliberately requires no OTP and reveals **only scope and status** to anyone who knows the phone number. It never returns the reason, account records, name, or phone number. This is the agreed public lookup behavior.

## Storage and behavior

- `accountDeletionRequest`: one indexed record per normalized phone number, with scope, status, optional reason, consent timestamp, and request/update timestamps.
- `accountDeletionOtp`: one independent challenge/quota record per phone. Codes are challenge-salted SHA-256 hashes, expire in five minutes, and allow five guesses. Sending is limited to one code per minute and five per hour per phone. There is no global/IP-based throttle in this version.
- A request is written only after valid SMS verification and explicit confirmation. Wrong-code attempts commit rather than rolling back. Challenge consumption and request persistence happen in the same mutation.
- An existing request returns its current status without SMS, even when its status is `Deleted`. The response includes a nullable `remainingScope` for any other registered profile not covered by the request.
- To add that remaining profile, the frontend explicitly calls the OTP endpoint with `extend: true`. Verification is required, and the challenge permits only that remaining profile. The same request is updated to `Both` and `Requested`; its original request timestamp is preserved. This version has no per-profile completion history or account-lifecycle handling.
- Intake reads user and rider/driver records only to determine eligible profiles. It does not modify accounts, permissions, sessions, rides, or files.
- The public API cannot set `Deleted`. Until administrative processing is implemented, trusted operators can inspect requests in the Convex dashboard. Set `Deleted` there only after actual manual processing; that field update itself performs no deletion.

## Verification

From the monorepo root:

```sh
yarn workspace @tutem/api test:account-deletion
yarn tsc -p packages/api/convex/tsconfig.json --noEmit
```

The eighteen handler-level integration tests use an indexed in-memory store and mocked SMS gateway. They cover Rider-only/Driver-only/both registrations, unknown numbers, unavailable or changed profiles, consent, code verification/expiry/attempt limits, duplicates, scope updates, status redaction, phone normalization, SMS failure, rate limits, and CORS/input checks. They do not replace validation of Convex transaction isolation or real SMS delivery after deployment.

The API package's broader `typecheck` currently reports pre-existing errors in unrelated files under its stricter shared TypeScript configuration; the Convex project's own check passes.
