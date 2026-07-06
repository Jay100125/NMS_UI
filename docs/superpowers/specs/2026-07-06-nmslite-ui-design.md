# NMSLITE_UI — Design Spec

> Web UI for Lite-NMS. React + TypeScript SPA over the Java/Vert.x REST API.
> Date: 2026-07-06. Repo: `~/personal/NMSLITE_UI` (separate from `Lite-NMS` and `NMSLITE_PLUGIN`).

## 1. Purpose & scope

Deliver the **full** operator-facing UI for Lite-NMS ("Cycle 2" of the v2 rearchitecture):
authenticate, manage credentials, run network discovery, provision monitored devices,
configure per-metric polling, and visualize collected metrics and availability. This spec
covers **all screens**, organized into modules so they can be built in waves.

The backend (`Lite-NMS`, `main`) is complete and stable: JWT auth, credential/discovery/
provisioning CRUD, availability, polled-data history, and `/health` + Prometheus `/metrics`.

## 2. Reference & IP boundary

The Motadata product UI under `/home/jay-patel/workspace/UI` (Vue 2 + Ant Design Vue +
Kendo + Highcharts) is the **employer's proprietary product**. It may be consulted **only**
for architectural inspiration — screen flows and information architecture. **No code,
component, schema, chart config, or asset is copied** into this repo. All code here is
written fresh. This mirrors the boundary already recorded for the backend repos.

## 3. Tech stack (decisions locked during brainstorming)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Dev server pinned to **:3000** (backend CORS allows only `http://localhost:3000`). |
| UI kit | **shadcn/ui + Tailwind CSS** | Copy-in components owned in-repo; bespoke look. |
| Charts | **Highcharts** (`highcharts-react-official`) | All configs authored fresh. Free under Highcharts' personal/non-commercial license for this résumé project; a paid license would be needed for commercial use. |
| Routing | **React Router v6** | `<ProtectedRoute>` guard redirects to `/login` without a valid token. |
| Server state | **TanStack Query (React Query)** | Caching, loading/error states, and `refetchInterval` polling for live views. |
| Client state | **Zustand** | Auth store (JWT + user); token persisted to `localStorage`, rehydrated on load. |
| HTTP | **Axios** single instance | Request interceptor attaches `Authorization: Bearer <jwt>`; response interceptor logs out on `401`. |
| Forms | **React Hook Form + Zod** | Schemas mirror backend validation. |
| Tables | **TanStack Table** + shadcn table | Sorting/filtering/pagination on CRUD lists. |
| Testing | **Vitest + React Testing Library + MSW** | Mocked API; flow-level tests. |
| Theming | Tailwind + shadcn tokens | Light/dark toggle. |

## 4. Backend API contract (what the client codes against)

**Base:** `http://localhost:8080`. All routes under `/api/*`. CORS origin: `http://localhost:3000`.

**Response envelope** (every handler uses this shape — the Axios layer normalizes it):

```jsonc
// success
{ "status.code": 200, "status": "success", "message": "...", "result": [ /* array */ ] }
// error
{ "status.code": 400, "status": "failure", "error": "..." }
```

`result` is **always a JSON array**. Single-object reads return a one-element array;
the login token is returned as `result[0]` (a raw JWT string).

**Auth:** `POST /api/login` and `POST /api/register` are public; every other `/api/*`
route requires `Authorization: Bearer <jwt>`. Tokens expire in 24h (claims `sub`, `exp`).
On `401` the client clears the token and redirects to `/login`.

**Endpoints:**

| Method | Path | Purpose | Request body (key fields) |
|---|---|---|---|
| POST | `/api/register` | Create user | `{ username, password }` (password ≥ 8 chars) |
| POST | `/api/login` | Authenticate | `{ username, password }` → `result[0]` = JWT |
| GET | `/api/credential` | List credentials | — |
| GET | `/api/credential/:id` | Get one | — |
| POST | `/api/credential` | Create | `{ credential_name, protocol: LINUX\|SNMP\|WINRM, cred_data: { user, password } }` |
| PATCH | `/api/credential/:id` | Update (partial) | any of the above |
| DELETE | `/api/credential/:id` | Delete | — |
| GET | `/api/discovery` | List profiles | — |
| GET | `/api/discovery/:id` | Get one | — |
| POST | `/api/discovery` | Create | `{ discovery_profile_name, ip, port, credential_profile_ids: [] }` |
| PUT | `/api/discovery/:id` | Update | same as create |
| DELETE | `/api/discovery/:id` | Delete | — |
| POST | `/api/discovery/:id/run` | Trigger scan (async; status transitions PENDING→RUNNING→COMPLETED/FAILED) | — |
| GET | `/api/discovery/:id/result` | Per-IP results (`COMPLETED`/`FAILED` + msg) | — |
| GET | `/api/provision` | List provisioning jobs | — |
| GET | `/api/provision/:id` | Job + its metrics | — |
| POST | `/api/provision/:id` | Provision selected discovered IPs into jobs | `{ selected_ips: [] }` (`:id` = discovery id) |
| PUT | `/api/provision/:id/metrics` | Update per-metric config | `{ metrics: [{ metric_name, polling_interval, is_enabled }] }` |
| DELETE | `/api/provision/:id` | Delete job | — |
| GET | `/api/polled-data` | All polled data | — |
| GET | `/api/polled-data/:id` | Polled data for a job (`:id` = job id), newest first | — |
| GET | `/api/availability/:jobId` | Up/down state + uptime % for a job | — |

Vocabulary (from the backend, one canonical set): `plugin_type`/`system_type` ∈
`LINUX|SNMP|WINRM`; discovery profile status ∈ `PENDING|RUNNING|COMPLETED|FAILED`;
discovery result ∈ `COMPLETED|FAILED`; metric names ∈
`CPU|MEMORY|DISK|NETWORK|PROCESS|UPTIME`.

Exact request/response field names are confirmed during the implementation plan against the
live API; the client wraps each endpoint in a typed module (§5) so a shape change is a
one-file edit.

## 5. Architecture

### Repo structure
```
NMSLITE_UI/
  src/
    api/            # axios instance + one typed module per domain
                    #   (auth, credentials, discovery, provisioning, metrics, availability)
    features/       # one folder per domain screen: components + query/mutation hooks
    components/ui/  # shadcn primitives (owned in-repo)
    components/     # shared: AppLayout, DataTable, chart wrappers, form fields, states
    stores/         # zustand: auth, ui (theme)
    routes/         # route tree + ProtectedRoute
    lib/            # queryClient, formatters, shared types, env
    App.tsx  main.tsx
  index.html  vite.config.ts  tailwind.config.ts  tsconfig.json
```

### Data layer (the core architectural rule)
Server data lives in **React Query**, never in Zustand. Each `features/<domain>` folder
owns typed hooks (`useCredentials`, `useCreateCredential`, `useRunDiscovery`, …) built on
the `api/<domain>` Axios module. Mutations `invalidateQueries` for the affected keys so
tables and charts refresh automatically. The Axios layer **unwraps the response envelope**
(returns `result`, throws on `status: "failure"` with the `error` message) so feature code
never sees the wrapper.

### Auth flow
1. `POST /api/login` → JWT (`result[0]`).
2. Store token + decoded `sub` in the Zustand auth store; persist token to `localStorage`.
3. Axios request interceptor adds `Authorization: Bearer`.
4. Response interceptor: on `401`, clear store + redirect `/login`.
5. `<ProtectedRoute>` gates the app shell; `/login` and `/register` render a bare card.

### Dev integration
Vite dev server on `:3000` proxies `/api` and `/health` to `:8080`, so the browser sees a
single origin in dev. `VITE_API_BASE` configures the production base URL.

## 6. Screens

Shared **AppLayout**: left sidebar nav (Dashboard, Credentials, Discovery, Provisioning) +
topbar (username, logout, dark-mode toggle). Every screen implements explicit **loading**
(skeleton), **error** (message + retry), and **empty** states.

1. **Login / Register** (`/login`, `/register`) — centered card, RHF+Zod validation,
   friendly server-error surfacing. Register enforces password ≥ 8.

2. **Dashboard** (`/`) — fleet overview: device up/down tiles and uptime % (from
   availability per job), total counts (credentials, discoveries, jobs), and recent-metric
   sparklines. Polls every ~10s.

3. **Credentials** (`/credentials`) — TanStack table (name, type); create/edit in a drawer
   (`credential_name`, `protocol` select, `user`, `password`). Passwords are **write-only**:
   never rendered back. Delete with confirm.

4. **Discovery list** (`/discovery`) — table (name, ip, port, status badge); create/edit
   drawer (name, ip, port, multi-select credentials). Delete with confirm. Row → detail.

5. **Discovery detail** (`/discovery/:id`) — profile summary, **Run** button
   (`POST …/run`), live status badge (polls while `RUNNING`), and a per-IP **results** table
   (`COMPLETED`/`FAILED` + message) from `…/result`. From here, select `COMPLETED` IPs to
   provision.

6. **Provisioning list** (`/provisioning`) — jobs table (ip, port, credential); provision
   flow posts selected discovered IPs; delete with confirm. Row → detail.

7. **Provisioning detail** (`/provisioning/:id`) — three panels:
   - **Metric config**: per-metric enable/disable + polling interval, saved via
     `PUT …/metrics`.
   - **History charts**: Highcharts time-series per enabled metric from
     `GET /api/polled-data/:id` (polls ~10s).
   - **Availability**: up/down + uptime % from `GET /api/availability/:id`.

## 7. Cross-cutting concerns

- **Live updates:** Dashboard, discovery-detail, provisioning-detail use React Query
  `refetchInterval` (~10s). No websockets (backend has none).
- **Error handling:** `401` → logout+redirect; other API errors → toast with server
  `error`; a top-level React error boundary catches render failures.
- **Secrets:** credential passwords are write-only in forms and never echoed from the API.
- **Accessibility/theming:** shadcn primitives (keyboard/focus handled); light/dark toggle.
- **Config:** `VITE_API_BASE` for prod; dev proxy for local.

## 8. Testing

Vitest + RTL + MSW (mock the exact envelope shape). Minimum coverage:
- `<ProtectedRoute>` gate (redirects unauthenticated; renders authenticated).
- One full CRUD flow end-to-end against MSW (Credentials): create → list → edit → delete.
- Discovery run → results flow (run triggers, status polls, results render).
- Axios envelope unwrapping (success unwraps `result`; `failure` throws `error`; `401`
  clears auth).

## 9. Build & deploy

`vite build` → static bundle servable by any static host or reverse-proxied alongside the
backend. README documents `VITE_API_BASE`, the dev proxy, prerequisites (Node 20+), and how
to run against a local Java backend. CI (GitHub Actions): `npm ci`, typecheck, lint, `vitest run`,
`vite build`.

## 10. Out of scope (future cycles)

Multi-user roles/RBAC, alerting/notifications, websockets/live-push, SNMP v3 credential
nuances beyond user/password, i18n, and mobile-native layouts. YAGNI until asked.

## 11. Success criteria

An operator can, entirely through the UI: log in → add a credential → create and run a
discovery → view results → provision a device → configure its metrics → watch metric
history and availability update live. All screens handle loading/error/empty states, the
suite is green, and `vite build` produces a deployable bundle.
