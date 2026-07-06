# Lite-NMS UI

Web UI for **Lite-NMS**, a lightweight network monitoring system whose backend
is a Java / Vert.x service exposing a JSON REST API. This repo is the frontend
only — it talks to that backend over HTTP and renders auth, credential
management, discovery, provisioning, per-device metric configuration and
history charts, availability, and a fleet dashboard.

Plan 1 shipped authentication (register/login, JWT persisted across reloads)
and full Credentials CRUD. Plan 2 (this cycle) added Discovery, Provisioning,
per-device metric configuration, Highcharts-based metric history +
availability, and the Dashboard — the UI is now functionally complete
end-to-end.

## Stack

- **React 19** (function components + hooks) **+ TypeScript**, built with **Vite**
- **shadcn/ui** components on top of **Tailwind CSS**
- **TanStack Query** for server-state (fetching/caching/mutations, live
  polling via `refetchInterval` for discovery status and availability)
- **Zustand** for client-state (auth session)
- **Axios** for HTTP, with a thin wrapper that unwraps the backend's response envelope
- **React Hook Form + Zod** for form state and validation
- **React Router v7**, with feature routes (Dashboard, Discovery,
  Provisioning, Credentials, and their detail pages) code-split via
  `React.lazy` + a single `<Suspense>` boundary — see [Build](#build) below
- **Highcharts** (`highcharts` + `highcharts-react-official`) for metric
  history charts. **License note:** Highcharts requires a commercial license
  for non-evaluation commercial use — confirm licensing before shipping this
  to a paying deployment.
- **Vitest + React Testing Library + MSW** for unit/integration tests (mocked API)

## Screens

- **Login / Register** (`/login`, `/register`) — JWT auth, session persisted
  across reloads, shared `AuthCard` layout.
- **Credentials** (`/credentials`) — CRUD for stored device credentials
  (`LINUX`/`SNMP`/`WINRM`). `cred_data` is encrypted at rest server-side and
  is write-only in the UI (never re-displayed); editing a credential without
  entering a new password keeps the existing one (the PATCH omits
  `cred_data` entirely in that case).
- **Discovery** (`/discovery`, `/discovery/:id`) — create/edit/delete
  discovery profiles (name, IP, port, one or more credential profiles), run a
  discovery, and watch its status live (`PENDING → RUNNING →
  COMPLETED/FAILED`, polled). The detail page lists per-credential discovery
  results and lets you select successfully-discovered IPs to provision.
- **Provisioning** (`/provisioning`, `/provisioning/:id`) — list of
  provisioned devices; the detail page has a metric-configuration panel
  (enable/disable + polling interval per metric: `CPU`, `MEMORY`, `DISK`,
  `NETWORK`, `PROCESS`, `UPTIME`), Highcharts time-series charts of polled
  metric history, and an availability panel (up/down state, uptime %).
- **Dashboard** (`/`) — fleet overview: total jobs, devices up/down, average
  uptime %, and a per-device table of IP / status / uptime.

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
npm run lint    # oxlint + tsc -b --noEmit (type-check only, no emit)
```

Feature routes (Dashboard, Discovery, Discovery detail, Provisioning,
Provisioning detail, Credentials) are lazy-loaded (`React.lazy` +
`<Suspense>` in `src/App.tsx`), so `vite build` emits one chunk per route
instead of a single monolithic bundle. In particular, Highcharts (used only
by the Provisioning detail page's metric charts) lands in that page's own
chunk and is not part of the main bundle — verified by grepping the built
`dist/assets/*.js` files for `Highcharts`.

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

## Endpoint contract (Discovery / Provisioning / Dashboard)

Every request/response shape below is copied verbatim from the confirmed
backend contract (verified against the handlers) used to build the Plan 2
screens:

| Screen | Method + path | Request body | Response (`result`) |
|---|---|---|---|
| Discovery create | `POST /api/discovery` | `{ "discovery_profile_name": string, "credential_profile_id": number[], "ip.address": string, "port": number }` ⚠️ dotted `ip.address` key; `credential_profile_id` is an ARRAY | `[{ id }]` |
| Discovery update | `PUT /api/discovery/:id` | same body as create | `[{ id }]` |
| Discovery list / get | `GET /api/discovery` / `/:id` | — | `[{ id, discovery_profile_name, ip, port, status, credential_profile_ids: number[] }]` (read uses `ip` + `credential_profile_ids`) |
| Discovery run | `POST /api/discovery/:id/run` | — (empty) | `[]` (async; profile status transitions PENDING→RUNNING→COMPLETED/FAILED) |
| Discovery results | `GET /api/discovery/:id/result` | — | `[{ id, discovery_id, ip, port, msg, credential_profile_id, result: "COMPLETED"\|"FAILED" }]` |
| Discovery delete | `DELETE /api/discovery/:id` | — | `[{ id }]` |
| Provision from discovery | `POST /api/provision/:id` (`:id` = **DISCOVERY** id) | `{ "selected_ips": string[] }` | `[{ validIps, invalidIps, insertedRecords:[{ ip, status, provisioning_job_id, metric_id, metric_name }] }]` |
| Provision list | `GET /api/provision` | — | `[{ id, credential_profile_id, plugin_type, ip, port, credential_name, system_type }]` |
| Provision get | `GET /api/provision/:id` | — | `[{ id, ip, port, metrics:[{ metric_name, polling_interval, is_enabled }] }]` |
| Metric config | `PUT /api/provision/:id/metrics` | `{ "metrics": [{ "metric_name": string, "polling_interval": number, "is_enabled": boolean }] }` | `[<jobId>]` |
| Provision delete | `DELETE /api/provision/:id` | — | `[{ id }]` |
| Polled data | `GET /api/polled-data/:id` (`:id` = **JOB** id) | — | `[{ id, job_id, metric_type, data: object, polled_at }]` newest first |
| Availability | `GET /api/availability/:jobId` | — | `[{ provisioning_job_id, is_up, last_change, up_samples, total_samples, availability_pct }]` — **404 when the job has no samples yet** (the UI treats this as "no data", not an error) |

Vocabulary: `system_type`/`plugin_type` ∈ `LINUX\|SNMP\|WINRM`; discovery
status ∈ `PENDING\|RUNNING\|COMPLETED\|FAILED`; discovery result ∈
`COMPLETED\|FAILED`; metric names ∈
`CPU\|MEMORY\|DISK\|NETWORK\|PROCESS\|UPTIME`.

Two easy-to-miss quirks worth flagging for anyone touching `src/api/*.ts`:

- **Discovery writes use a dotted key**: the create/update request body's IP
  field is literally `"ip.address"` (not `ip`), and `credential_profile_id`
  is sent as an **array**. The read shape uses plain `ip` and
  `credential_profile_ids` (array, plural) instead — `src/api/discovery.ts`
  translates between the clean `DiscoveryInput` type the UI uses and this
  wire shape so the rest of the app never sees the dotted key.
- **Provisioning is keyed by the DISCOVERY id, not a job id**:
  `POST /api/provision/:id` takes the **discovery profile's** id plus a
  `selected_ips` array (the IPs from that discovery's results to provision).
  Polled-data and availability, by contrast, are keyed by the
  **provisioning job** id (`GET /api/polled-data/:id`,
  `GET /api/availability/:jobId`).

## Manual smoke-test checklist (run against a live backend)

Automated tests here run entirely against MSW mocks, so **live verification
against the real Java backend was not performed in this environment** — no
backend instance was available (this dev environment has no JVM/backend
process running, and standing one up was explicitly out of scope for this
task). This is a deferred step for whoever runs this next, with
`NMS_JWT_SECRET` and `NMS_CRED_KEY` set on the backend. Before considering a
change "done" against the real backend, walk through the full journey:

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
   you can, not the UI.) Then **edit** it, leaving the password blank, and
   confirm the existing password still works for later steps (i.e. the PATCH
   didn't null it out) — this exercises the optional-password-on-edit path.
7. **Create + run a discovery**: go to `/discovery`, create a profile
   against a reachable device/credential, click into its detail page, run
   it, and watch the status poll from `PENDING`/`RUNNING` to
   `COMPLETED`/`FAILED`. Confirm the per-IP results list appears.
8. **Provision a completed IP**: from the discovery detail page, select an
   IP with a `COMPLETED` result and provision it. Confirm it now shows up
   under `/provisioning`.
9. **Configure metrics**: open the new job's detail page
   (`/provisioning/:id`), toggle metrics on/off and adjust polling
   intervals, save, and confirm the change persists on reload.
10. **View charts/availability**: wait for at least one poll cycle, then
    confirm the Highcharts metric-history charts render real data points and
    the availability panel shows an up/down state with a plausible uptime %.
    (If the job has zero samples yet, availability should render as an empty
    state, not an error — the backend returns 404 in that case.)
11. **Dashboard**: go to `/`, confirm total/up/down device counts and the
    average uptime % tile match what you saw on the provisioning/availability
    screens, and that the per-device table lists the job(s) you just created.
12. **Delete**: delete the provisioning job and the discovery profile, and
    confirm both disappear from their respective lists.
13. **Logout**: confirm you're returned to `/login`, and that a reload no
    longer restores the session.

If any step surfaces a mismatch between what the UI expects and what the real
backend actually returns (field names, envelope shape, status codes,
especially the `ip.address`/`credential_profile_id` discovery-write shape and
the `selected_ips` provision-from-discovery shape called out above), that's
the point where those assumptions get corrected — fix the corresponding
types in `src/lib/types.ts` and the wire-shape translation in `src/api/*.ts`
accordingly.
