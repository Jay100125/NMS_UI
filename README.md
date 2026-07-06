# Lite-NMS UI

Web UI for **Lite-NMS**, a lightweight network monitoring system whose backend
is a Java / Vert.x service exposing a JSON REST API. This repo is the frontend
only — it talks to that backend over HTTP and renders auth, credential
management, and (in a later cycle) discovery/provisioning/dashboard screens.

This is Plan 1 of the project: authentication (register/login, JWT persisted
across reloads) and full Credentials CRUD. Discovery, Provisioning, the
Dashboard, and Highcharts-based visualizations are deferred to Plan 2.

## Stack

- **React 18-era** (function components + hooks) **+ TypeScript**, built with **Vite**
- **shadcn/ui** components on top of **Tailwind CSS**
- **TanStack Query** for server-state (fetching/caching/mutations)
- **Zustand** for client-state (auth session)
- **Axios** for HTTP, with a thin wrapper that unwraps the backend's response envelope
- **React Hook Form + Zod** for form state and validation
- **Vitest + React Testing Library + MSW** for unit/integration tests (mocked API)
- **Highcharts** is planned for Plan 2 (Dashboard charts) — not installed yet.
  Note: Highcharts requires a commercial license for non-evaluation commercial
  use; confirm licensing before shipping chart features.

## Prerequisites

- Node.js **20+** (developed/tested against Node 20.20.2)
- A running instance of the Lite-NMS Java/Vert.x backend (see below) if you want
  to exercise real API calls instead of the mocked test suite

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on **http://localhost:3000**.

### Pointing at the backend

The app reads its API base URL from the `VITE_API_BASE` environment variable
(see `.env.example`):

```
VITE_API_BASE=http://localhost:8080
```

- If `VITE_API_BASE` is **unset**, it defaults to an empty string, and the
  Vite **dev server proxy** forwards relative `/api` and `/health` requests to
  `http://localhost:8080` (see `vite.config.ts`). This is the easiest way to
  develop locally — leave `VITE_API_BASE` unset and just start the backend on
  port 8080.
- If you set `VITE_API_BASE` (e.g. to point at a remote/staged backend), the
  app calls that origin directly instead of using the dev proxy.

To run against a real backend:

```bash
NMS_JWT_SECRET=<secret> NMS_CRED_KEY=<key> java -jar <lite-nms-backend>.jar
```

...then, in another terminal, `npm run dev` (with `VITE_API_BASE` unset so the
proxy picks up `:8080`).

## Testing

```bash
npm test        # runs the Vitest suite once (vitest run)
npm run test:watch  # watch mode
```

Tests use MSW to mock the backend, so `npm test` does not require a running
Java backend.

## Build

```bash
npm run build   # tsc -b (type-check) + vite build -> dist/
npm run lint    # tsc -b --noEmit (type-check only, no emit)
```

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request: checkout → `actions/setup-node@v4` (Node 20, npm cache) → `npm ci` →
`npm run lint` → `npm test` → `npm run build`.

## Backend response-envelope contract

Every API response from the Lite-NMS backend is wrapped in the same envelope
shape:

```json
{
  "status.code": 200,
  "status": "success",
  "message": "optional human-readable message",
  "error": "optional error text (present when status is \"failure\")",
  "result": []
}
```

- `result` is **always an array**, even for single-object responses.
- `status` is either `"success"` or `"failure"`. On `"failure"`, `error`
  carries the message and `result` may be absent.
- The frontend never touches this envelope directly — `src/api/client.ts`
  exports `unwrap<T>()`, which every API call goes through. It resolves to
  `body.result` on success and throws `new Error(body.error)` on failure.
- **Login is a special case**: the login endpoint's `result` array's first
  element is the JWT token — i.e. `result[0]` — see `src/api/auth.ts`.

## Manual smoke-test checklist (run against a live backend)

Automated tests here run entirely against MSW mocks, so **live verification
against the real Java backend was not performed in this environment** (no
backend instance was available) and is deferred to whoever runs this next.
Before considering a change to auth/credentials "done" against the real
backend, walk through:

1. Start the backend: `NMS_JWT_SECRET=... NMS_CRED_KEY=... java -jar <lite-nms-backend>.jar` on `:8080`.
2. `npm run dev` (leave `VITE_API_BASE` unset so the dev proxy forwards to `:8080`).
3. **Register**: go to `/register`, create a new user. Expect success and a
   redirect/prompt to log in.
4. **Login**: log in with that user. Expect redirect to the app shell (`/`)
   and the JWT to be stored.
5. **Token persists across reload**: refresh the page while logged in —
   you should stay authenticated (not bounced to `/login`).
6. **Create a credential**: go to `/credentials`, create one (name, protocol,
   username/password). Verify it appears in the list. (The `cred_data` stored
   server-side should be ciphertext, not plaintext — check the backend/DB if
   you can, not the UI.)
7. **Edit** that credential (e.g. change the name or password) and confirm
   the update is reflected in the list.
8. **Delete** it and confirm it disappears from the list.
9. **Logout**: confirm you're returned to `/login`, and that a reload no
   longer restores the session.

If any step surfaces a mismatch between what the UI expects and what the real
backend actually returns (field names, envelope shape, status codes), that's
the point where those assumptions get corrected — fix the `ApiEnvelope`/
`Credential`/`CredentialInput` types and the `unwrap` call sites in
`src/api/*.ts` and `src/lib/types.ts` accordingly.
