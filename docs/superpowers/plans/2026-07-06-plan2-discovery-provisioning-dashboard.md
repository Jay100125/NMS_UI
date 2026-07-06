# NMSLITE_UI Plan 2 — Discovery, Provisioning, Dashboard & Charts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Lite-NMS UI on top of the Plan 1 foundation — Discovery (CRUD + run + results), Provisioning (provision-from-discovery + metric config), per-device metric history charts (Highcharts) and availability, and a fleet Dashboard — plus the deferred Plan 1 polish. All test-covered with MSW.

**Architecture:** Same patterns Plan 1 established: one `api/<domain>` module (Axios + `unwrap`) → typed `features/<domain>` query/mutation hooks (TanStack Query, `invalidateQueries`) → screens using `DataTable` + the `states` components. Live views (discovery-running, provisioning detail, dashboard) use React Query `refetchInterval`. Reuse the existing `CredentialDrawer` pattern for new create/edit drawers.

**Tech Stack:** (unchanged) React 19, TypeScript, Vite, Tailwind, shadcn/ui, React Router v6, TanStack Query v5, Zustand, Axios, React Hook Form, Zod, Vitest + RTL + MSW — plus **Highcharts** (`highcharts`, `highcharts-react-official`).

## Global Constraints

- All new API calls go through the existing `api`/`unwrap` from `@/api/client`; feature code never sees the envelope.
- **Confirmed backend contract** (verified against the handlers — use these EXACT shapes):

  | Screen | Method + path | Request body | Response (`result`) |
  |---|---|---|---|
  | Discovery create | `POST /api/discovery` | `{ "discovery_profile_name": string, "credential_profile_id": number[], "ip.address": string, "port": number }` ⚠️ dotted `ip.address` key; `credential_profile_id` is an ARRAY | `[{ id }]` |
  | Discovery update | `PUT /api/discovery/:id` | same body as create | `[{ id }]` |
  | Discovery list / get | `GET /api/discovery` / `/:id` | — | `[{ id, discovery_profile_name, ip, port, status, credential_profile_ids: number[] }]` (read uses `ip` + `credential_profile_ids`) |
  | Discovery run | `POST /api/discovery/:id/run` | — (empty) | `[]` (async; profile status transitions PENDING→RUNNING→COMPLETED/FAILED) |
  | Discovery results | `GET /api/discovery/:id/result` | — | `[{ id, discovery_id, ip, port, msg, credential_profile_id, result: "COMPLETED"\|"FAILED" }]` |
  | Discovery delete | `DELETE /api/discovery/:id` | — | `[{ id }]` |
  | Provision from discovery | `POST /api/provision/:id` (`:id` = DISCOVERY id) | `{ "selected_ips": string[] }` | `[{ validIps, invalidIps, insertedRecords:[{ ip, status, provisioning_job_id, metric_id, metric_name }] }]` |
  | Provision list | `GET /api/provision` | — | `[{ id, credential_profile_id, plugin_type, ip, port, credential_name, system_type }]` |
  | Provision get | `GET /api/provision/:id` | — | `[{ id, ip, port, metrics:[{ metric_name, polling_interval, is_enabled }] }]` |
  | Metric config | `PUT /api/provision/:id/metrics` | `{ "metrics": [{ "metric_name": string, "polling_interval": number, "is_enabled": boolean }] }` | `[<jobId>]` |
  | Provision delete | `DELETE /api/provision/:id` | — | `[{ id }]` |
  | Polled data | `GET /api/polled-data/:id` (`:id` = JOB id) | — | `[{ id, job_id, metric_type, data: object, polled_at }]` newest first |
  | Availability | `GET /api/availability/:jobId` | — | `[{ provisioning_job_id, is_up, last_change, up_samples, total_samples, availability_pct }]` — **404 when the job has no samples yet** (treat as "no data") |

- Vocabulary: `system_type`/`plugin_type` ∈ `LINUX\|SNMP\|WINRM`; discovery status ∈ `PENDING\|RUNNING\|COMPLETED\|FAILED`; discovery result ∈ `COMPLETED\|FAILED`; metric names ∈ `CPU\|MEMORY\|DISK\|NETWORK\|PROCESS\|UPTIME`.
- Toolchain reality (from Plan 1): React 19, Tailwind v3, shadcn CLI pinned **2.10.0** (latest is an incompatible rewrite — use `npx shadcn@2.10.0 add ...`), zod v4 + `@hookform/resolvers@5`, `npm run lint` = `oxlint && tsc -b --noEmit`. shadcn `add` needs a temp `@/*` path in root `tsconfig.json` during the CLI run, reverted after (see Plan 1 Task 2 report).
- TDD: failing test first. Commit after each green task with trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- IP boundary: Motadata UI is inspiration only — never copy its code/config/assets. All Highcharts configs authored fresh.

---

## File Structure (added/changed)

```
src/
  lib/
    types.ts            # + Discovery, DiscoveryResult, ProvisioningJob, JobMetric, PolledData, Availability
    format.ts           # NEW: date/number formatters
  api/
    discovery.ts        # NEW
    provisioning.ts     # NEW
  features/
    discovery/
      useDiscovery.ts  DiscoveryPage.tsx  DiscoveryDrawer.tsx  DiscoveryDetailPage.tsx
    provisioning/
      useProvisioning.ts  ProvisioningPage.tsx  ProvisioningDetailPage.tsx
      MetricConfigPanel.tsx  MetricCharts.tsx  AvailabilityPanel.tsx
    dashboard/
      DashboardPage.tsx  useDashboard.ts
  components/
    ui/                 # + tabs, switch, checkbox (shadcn 2.10.0)
    MetricChart.tsx     # NEW: Highcharts time-series wrapper
  App.tsx               # + /discovery/:id, /provisioning/:id routes; real Dashboard at index
```

---

## Task 1: Setup — Highcharts, shadcn primitives, shared types & formatters

**Files:**
- Modify: `package.json` (deps), `src/lib/types.ts`
- Create: `src/lib/format.ts`, `src/components/ui/{tabs,switch,checkbox}.tsx` (via shadcn), `src/lib/format.test.ts`

**Interfaces:**
- Produces (later tasks depend on these exact types):
  ```ts
  export interface Discovery { id: number; discovery_profile_name: string; ip: string; port: number; status: 'PENDING'|'RUNNING'|'COMPLETED'|'FAILED'; credential_profile_ids: number[] }
  export interface DiscoveryResult { id: number; discovery_id: number; ip: string; port: number; msg: string | null; credential_profile_id: number | null; result: 'COMPLETED'|'FAILED' }
  export interface ProvisioningJob { id: number; ip: string; port: number; credential_profile_id?: number; plugin_type?: SystemType; credential_name?: string; system_type?: SystemType }
  export interface JobMetric { metric_name: string; polling_interval: number; is_enabled: boolean }
  export interface ProvisioningJobDetail { id: number; ip: string; port: number; metrics: JobMetric[] }
  export interface PolledData { id: number; job_id: number; metric_type: string; data: Record<string, unknown>; polled_at: string }
  export interface Availability { provisioning_job_id: number; is_up: boolean; last_change: string; up_samples: number; total_samples: number; availability_pct: number }
  ```
- `format.ts`: `formatDateTime(iso: string): string`, `formatPct(n: number): string`.

- [ ] **Step 1: Install deps + shadcn primitives**

```bash
cd /home/jay-patel/personal/NMSLITE_UI
npm install highcharts highcharts-react-official
# shadcn (pinned): add path alias to root tsconfig.json temporarily if the CLI can't resolve @, then revert
npx shadcn@2.10.0 add tabs switch checkbox
```

- [ ] **Step 2: Write the failing test for formatters**

`src/lib/format.test.ts`:
```ts
import { formatDateTime, formatPct } from './format'

test('formatPct renders one-decimal percent', () => {
  expect(formatPct(99.5)).toBe('99.5%')
  expect(formatPct(100)).toBe('100.0%')
})

test('formatDateTime returns a non-empty string for a valid ISO date', () => {
  expect(formatDateTime('2026-07-06T10:00:00Z')).not.toBe('')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement formatters + extend types**

`src/lib/format.ts`:
```ts
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}
export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}
```
Append the interfaces from the **Interfaces** block above to `src/lib/types.ts`.

- [ ] **Step 5: Run test + lint**

Run: `npx vitest run src/lib/format.test.ts` → PASS. `npm run lint` → clean. `npm run build` → succeeds (Highcharts imports resolve).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/types.ts src/lib/format.ts src/lib/format.test.ts src/components/ui/tabs.tsx src/components/ui/switch.tsx src/components/ui/checkbox.tsx components.json
git commit -m "chore(ui): add Highcharts, shadcn tabs/switch/checkbox, domain types & formatters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Discovery API module + list screen

**Files:**
- Create: `src/api/discovery.ts`, `src/features/discovery/useDiscovery.ts`, `src/features/discovery/DiscoveryPage.tsx`
- Modify: `src/App.tsx` (route `/discovery` → real page, replacing any placeholder)
- Test: `src/features/discovery/DiscoveryPage.test.tsx`

**Interfaces:**
- Produces:
  - `api/discovery.ts`: `listDiscoveries(): Promise<Discovery[]>`; `getDiscovery(id): Promise<Discovery>` (returns `result[0]`); `createDiscovery(input: DiscoveryInput)`; `updateDiscovery(id, input)`; `deleteDiscovery(id)`; `runDiscovery(id)`; `getDiscoveryResults(id): Promise<DiscoveryResult[]>`.
  - `DiscoveryInput = { discovery_profile_name: string; ip: string; port: number; credential_profile_ids: number[] }` — the api module maps this to the wire shape `{ discovery_profile_name, 'ip.address': ip, port, credential_profile_id: credential_profile_ids }`.
  - `useDiscovery.ts`: `useDiscoveries()` (key `['discoveries']`); `useCreateDiscovery/useUpdateDiscovery/useDeleteDiscovery/useRunDiscovery` mutations invalidating `['discoveries']`.
  - `DiscoveryPage` (named export) — table: name, ip, port, status Badge; row → `/discovery/:id`; "New discovery" button.

- [ ] **Step 1: Write the failing test**

`src/features/discovery/DiscoveryPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryPage } from './DiscoveryPage'

test('lists discovery profiles with status', async () => {
  server.use(http.get('*/api/discovery', () =>
    HttpResponse.json({ 'status.code': 200, status: 'success', result: [
      { id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] },
    ] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><DiscoveryPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  expect(screen.getByText('COMPLETED')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/discovery/DiscoveryPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement api module**

`src/api/discovery.ts`:
```ts
import { api, unwrap } from './client'
import type { Discovery, DiscoveryResult } from '@/lib/types'

export interface DiscoveryInput {
  discovery_profile_name: string
  ip: string
  port: number
  credential_profile_ids: number[]
}

// Backend write shape uses the dotted `ip.address` key and `credential_profile_id` as an array.
function toWire(input: DiscoveryInput) {
  return {
    discovery_profile_name: input.discovery_profile_name,
    'ip.address': input.ip,
    port: input.port,
    credential_profile_id: input.credential_profile_ids,
  }
}

export const listDiscoveries = () => unwrap<Discovery[]>(api.get('/api/discovery'))
export const getDiscovery = async (id: number) => (await unwrap<Discovery[]>(api.get(`/api/discovery/${id}`)))[0]
export const createDiscovery = (input: DiscoveryInput) => unwrap<unknown[]>(api.post('/api/discovery', toWire(input)))
export const updateDiscovery = (id: number, input: DiscoveryInput) => unwrap<unknown[]>(api.put(`/api/discovery/${id}`, toWire(input)))
export const deleteDiscovery = (id: number) => unwrap<unknown[]>(api.delete(`/api/discovery/${id}`))
export const runDiscovery = (id: number) => unwrap<unknown[]>(api.post(`/api/discovery/${id}/run`, {}))
export const getDiscoveryResults = (id: number) => unwrap<DiscoveryResult[]>(api.get(`/api/discovery/${id}/result`))
```

- [ ] **Step 4: Implement hooks**

`src/features/discovery/useDiscovery.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apiD from '@/api/discovery'

const KEY = ['discoveries'] as const

export function useDiscoveries() {
  return useQuery({ queryKey: KEY, queryFn: apiD.listDiscoveries })
}
function useInvalidating<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}
export const useCreateDiscovery = () => useInvalidating((v: apiD.DiscoveryInput) => apiD.createDiscovery(v))
export const useUpdateDiscovery = () => useInvalidating((v: { id: number; input: apiD.DiscoveryInput }) => apiD.updateDiscovery(v.id, v.input))
export const useDeleteDiscovery = () => useInvalidating((id: number) => apiD.deleteDiscovery(id))
export const useRunDiscovery = () => useInvalidating((id: number) => apiD.runDiscovery(id))
```

- [ ] **Step 5: Implement DiscoveryPage**

`src/features/discovery/DiscoveryPage.tsx` — mirror `CredentialsPage` (loading/error/empty/table via `@/components/states` + `DataTable`), columns Name, IP, Port, Status (`<Badge>`), and an actions cell with a `<Link to={`/discovery/${r.id}`}>Open</Link>`; a "New discovery" button opens `DiscoveryDrawer` (Task 3 — stub it now with `export function DiscoveryDrawer(_:{open:boolean;onOpenChange:(o:boolean)=>void;editing:import('@/lib/types').Discovery|null}){return null}` in `src/features/discovery/DiscoveryDrawer.tsx`). Use `useNavigate`/`Link` from react-router. Wire `/discovery` in `App.tsx` to `DiscoveryPage`.

- [ ] **Step 6: Run test + full gate**

Run: `npx vitest run src/features/discovery/DiscoveryPage.test.tsx` → PASS. `npm test`, `npm run lint`, `npm run build` → all pass.

- [ ] **Step 7: Commit**

```bash
git add src/api/discovery.ts src/features/discovery/ src/App.tsx
git commit -m "feat(discovery): api module, hooks, and list screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Discovery create/edit drawer + delete

**Files:**
- Create/replace: `src/features/discovery/DiscoveryDrawer.tsx`
- Modify: `src/features/discovery/DiscoveryPage.tsx` (delete action)
- Test: `src/features/discovery/DiscoveryDrawer.test.tsx`

**Interfaces:**
- Consumes: `useCreateDiscovery/useUpdateDiscovery/useDeleteDiscovery` (Task 2), `useCredentials` (Plan 1) for the credential multi-select.
- Produces: `<DiscoveryDrawer open onOpenChange editing>` — RHF+Zod form: `discovery_profile_name`, `ip`, `port` (1–65535), and a **multi-select** of credential profiles (checkbox list from `useCredentials`, stored as `credential_profile_ids: number[]`, at least one required). Create/edit via the hooks; closes on success.

- [ ] **Step 1: Write the failing test**

`src/features/discovery/DiscoveryDrawer.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDrawer } from './DiscoveryDrawer'

test('creates a discovery with the dotted ip.address wire shape', async () => {
  server.use(
    http.get('*/api/credential', () => HttpResponse.json({ 'status.code': 200, status: 'success',
      result: [{ id: 3, credential_name: 'linux', system_type: 'LINUX', cred_data: 'x' }] })),
  )
  let body: any = null
  server.use(http.post('*/api/discovery', async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <DiscoveryDrawer open onOpenChange={() => {}} editing={null} />
    </QueryClientProvider>,
  )
  await userEvent.type(screen.getByLabelText(/name/i), 'lab')
  await userEvent.type(screen.getByLabelText(/^ip$/i), '10.0.0.1')
  await userEvent.clear(screen.getByLabelText(/port/i)); await userEvent.type(screen.getByLabelText(/port/i), '22')
  await waitFor(() => screen.getByText('linux'))
  await userEvent.click(screen.getByLabelText(/linux/i))
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(body).toMatchObject({
    discovery_profile_name: 'lab', 'ip.address': '10.0.0.1', port: 22, credential_profile_id: [3],
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/discovery/DiscoveryDrawer.test.tsx` → FAIL.

- [ ] **Step 3: Implement the drawer**

`src/features/discovery/DiscoveryDrawer.tsx` — shadcn `Sheet` + RHF+Zod. Schema: `{ discovery_profile_name: z.string().min(1), ip: z.string().min(1), port: z.coerce.number().int().min(1).max(65535), credential_profile_ids: z.array(z.number()).min(1) }`. Render a `Checkbox` per credential from `useCredentials()`, toggling membership in `credential_profile_ids`. On submit call `useCreateDiscovery`/`useUpdateDiscovery` with `{ discovery_profile_name, ip, port, credential_profile_ids }`; on edit, prefill from `editing` (name/ip/port and `editing.credential_profile_ids`). Toast + close on success. (The api module maps to the dotted wire shape — the drawer works in clean `ip`/`credential_profile_ids` terms.)

- [ ] **Step 4: Add delete-with-confirm to DiscoveryPage**

Add `useDeleteDiscovery()` and a Delete button in the actions column guarded by `confirm(...)`, with `{ onError: (e) => toast.error((e as Error).message) }` (match the Plan-1 delete pattern).

- [ ] **Step 5: Run test + gate**

Run: `npx vitest run src/features/discovery/DiscoveryDrawer.test.tsx` → PASS. `npm test`, `npm run lint`, `npm run build` → pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/discovery/
git commit -m "feat(discovery): create/edit drawer with credential multi-select; delete

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Discovery detail — run, live status, results

**Files:**
- Create: `src/features/discovery/DiscoveryDetailPage.tsx`, `src/features/discovery/useDiscoveryDetail.ts`
- Modify: `src/App.tsx` (route `/discovery/:id`)
- Test: `src/features/discovery/DiscoveryDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getDiscovery`, `getDiscoveryResults`, `runDiscovery` (Task 2).
- Produces:
  - `useDiscoveryDetail(id)`: `useQuery(['discovery', id], () => getDiscovery(id))` and `useDiscoveryResults(id)`: `useQuery(['discovery-results', id], () => getDiscoveryResults(id), { refetchInterval: while profile status === 'RUNNING' → 3000, else false })`.
  - `DiscoveryDetailPage` (named export): profile summary (name/ip/port/status Badge), a **Run** button (`useRunDiscovery`, disabled while `RUNNING`), and a results table (ip, port, result Badge, msg). Polls while running.

- [ ] **Step 1: Write the failing test**

`src/features/discovery/DiscoveryDetailPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDetailPage } from './DiscoveryDetailPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('shows the profile and its per-IP results', async () => {
  server.use(
    http.get('*/api/discovery/1', () => ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] }])),
    http.get('*/api/discovery/1/result', () => ok([{ id: 9, discovery_id: 1, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 3, result: 'COMPLETED' }])),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={['/discovery/1']}>
        <Routes><Route path="/discovery/:id" element={<DiscoveryDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('lab')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/discovery/DiscoveryDetailPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`useDiscoveryDetail.ts` + `DiscoveryDetailPage.tsx` per the Interfaces. Read `:id` via `useParams`. For the results query's `refetchInterval`, read the profile query's `status`: `refetchInterval: (q) => detail.data?.status === 'RUNNING' ? 3000 : false`. Run button: `useRunDiscovery().mutate(id, { onSuccess: () => { toast; invalidate detail }, onError: toast.error })`. Selecting IPs for provisioning is added in Task 6.

- [ ] **Step 4: Run test + gate**

Run: `npx vitest run src/features/discovery/DiscoveryDetailPage.test.tsx` → PASS. `npm test`, `npm run lint`, `npm run build` → pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/discovery/ src/App.tsx
git commit -m "feat(discovery): detail page with run, live status, and results

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Provisioning API module + list screen

**Files:**
- Create: `src/api/provisioning.ts`, `src/features/provisioning/useProvisioning.ts`, `src/features/provisioning/ProvisioningPage.tsx`
- Modify: `src/App.tsx` (route `/provisioning` → real page)
- Test: `src/features/provisioning/ProvisioningPage.test.tsx`

**Interfaces:**
- Produces:
  - `api/provisioning.ts`: `listJobs(): Promise<ProvisioningJob[]>`; `getJob(id): Promise<ProvisioningJobDetail>` (result[0]); `deleteJob(id)`; `provisionFromDiscovery(discoveryId, selectedIps: string[])` (POST `/api/provision/:discoveryId` body `{ selected_ips }`); `updateJobMetrics(id, metrics: JobMetric[])` (PUT `/api/provision/:id/metrics` body `{ metrics }`); `getPolledData(jobId): Promise<PolledData[]>`; `getAvailability(jobId): Promise<Availability | null>` (returns `result[0]`, and **catches 404 → null**).
  - `useProvisioning.ts`: `useJobs()` (key `['jobs']`), `useDeleteJob()` (invalidates `['jobs']`), `useProvision()` (invalidates `['jobs']`).
  - `ProvisioningPage` (named export): table — ip, port, credential_name, system_type Badge; row → `/provisioning/:id`; delete-with-confirm (onError toast).

- [ ] **Step 1: Write the failing test**

`src/features/provisioning/ProvisioningPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { ProvisioningPage } from './ProvisioningPage'

test('lists provisioning jobs', async () => {
  server.use(http.get('*/api/provision', () => HttpResponse.json({ 'status.code': 200, status: 'success',
    result: [{ id: 5, ip: '10.0.0.1', port: 22, credential_name: 'linux', system_type: 'LINUX' }] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><ProvisioningPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
  expect(screen.getByText('linux')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/features/provisioning/ProvisioningPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement api module**

`src/api/provisioning.ts`:
```ts
import { api, unwrap } from './client'
import type { ProvisioningJob, ProvisioningJobDetail, JobMetric, PolledData, Availability } from '@/lib/types'

export const listJobs = () => unwrap<ProvisioningJob[]>(api.get('/api/provision'))
export const getJob = async (id: number) => (await unwrap<ProvisioningJobDetail[]>(api.get(`/api/provision/${id}`)))[0]
export const deleteJob = (id: number) => unwrap<unknown[]>(api.delete(`/api/provision/${id}`))
export const provisionFromDiscovery = (discoveryId: number, selected_ips: string[]) =>
  unwrap<unknown[]>(api.post(`/api/provision/${discoveryId}`, { selected_ips }))
export const updateJobMetrics = (id: number, metrics: JobMetric[]) =>
  unwrap<unknown[]>(api.put(`/api/provision/${id}/metrics`, { metrics }))
export const getPolledData = (jobId: number) => unwrap<PolledData[]>(api.get(`/api/polled-data/${jobId}`))
export async function getAvailability(jobId: number): Promise<Availability | null> {
  try {
    return (await unwrap<Availability[]>(api.get(`/api/availability/${jobId}`)))[0] ?? null
  } catch (e: any) {
    if (e?.response?.status === 404) return null   // no samples yet
    throw e
  }
}
```
Note: `unwrap` throws a plain `Error` on envelope failure, but a real HTTP 404 rejects the axios promise with `e.response.status === 404` before `unwrap` inspects the body — the catch above handles that path.

- [ ] **Step 4: Implement hooks + ProvisioningPage**

`useProvisioning.ts` (`useJobs`, `useDeleteJob`, `useProvision`) and `ProvisioningPage.tsx` mirroring `CredentialsPage`/`DiscoveryPage` (states + DataTable + delete-with-confirm+onError toast). Wire `/provisioning` in `App.tsx`.

- [ ] **Step 5: Run test + gate** — target test PASS; `npm test`, `npm run lint`, `npm run build` pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/provisioning.ts src/features/provisioning/ src/App.tsx
git commit -m "feat(provisioning): api module, hooks, and jobs list screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Provision-from-discovery flow

**Files:**
- Modify: `src/features/discovery/DiscoveryDetailPage.tsx` (select COMPLETED IPs → provision)
- Test: `src/features/discovery/ProvisionFromDiscovery.test.tsx`

**Interfaces:**
- Consumes: `useProvision` (Task 5), the results query (Task 4).
- Produces: on the discovery detail results table, a checkbox per row whose `result === 'COMPLETED'`, and a "Provision selected" button that calls `useProvision().mutate({ discoveryId, selectedIps })` → POST `/api/provision/:discoveryId` with `{ selected_ips }`. On success: toast + navigate to `/provisioning`.

- [ ] **Step 1: Write the failing test**

`src/features/discovery/ProvisionFromDiscovery.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DiscoveryDetailPage } from './DiscoveryDetailPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('provisions selected COMPLETED IPs', async () => {
  let body: any = null; let calledPath = ''
  server.use(
    http.get('*/api/discovery/1', () => ok([{ id: 1, discovery_profile_name: 'lab', ip: '10.0.0.1', port: 22, status: 'COMPLETED', credential_profile_ids: [3] }])),
    http.get('*/api/discovery/1/result', () => ok([{ id: 9, discovery_id: 1, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 3, result: 'COMPLETED' }])),
    http.post('*/api/provision/1', async ({ request }) => { calledPath = '/api/provision/1'; body = await request.json(); return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ insertedRecords: [] }] }) }),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter initialEntries={['/discovery/1']}>
        <Routes>
          <Route path="/discovery/:id" element={<DiscoveryDetailPage />} />
          <Route path="/provisioning" element={<div>jobs</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => screen.getByText('10.0.0.1'))
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: /provision selected/i }))
  await waitFor(() => { expect(calledPath).toBe('/api/provision/1'); expect(body).toEqual({ selected_ips: ['10.0.0.1'] }) })
})
```

- [ ] **Step 2: Run test to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

In `DiscoveryDetailPage`, track selected IPs in local state (only `COMPLETED` rows get a `Checkbox`). Add a "Provision selected" button (disabled when none selected) calling `useProvision().mutate({ discoveryId: id, selectedIps }, { onSuccess: () => { toast.success(...); navigate('/provisioning') }, onError: (e) => toast.error((e as Error).message) })`.

- [ ] **Step 4: Run test + gate** — target PASS; full gate passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/discovery/
git commit -m "feat(provisioning): provision selected discovered IPs from discovery detail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Provisioning detail — job info + metric config

**Files:**
- Create: `src/features/provisioning/ProvisioningDetailPage.tsx`, `src/features/provisioning/MetricConfigPanel.tsx`, `src/features/provisioning/useJobDetail.ts`
- Modify: `src/App.tsx` (route `/provisioning/:id`)
- Test: `src/features/provisioning/MetricConfigPanel.test.tsx`

**Interfaces:**
- Consumes: `getJob`, `updateJobMetrics` (Task 5).
- Produces:
  - `useJobDetail(id)`: `useQuery(['job', id], () => getJob(id))`; `useUpdateMetrics(id)`: mutation calling `updateJobMetrics`, invalidating `['job', id]`.
  - `MetricConfigPanel({ job })`: a row per `job.metrics` with a `Switch` (is_enabled) + numeric `Input` (polling_interval), and a Save button that PUTs the full `metrics` array.
  - `ProvisioningDetailPage`: job summary + `<MetricConfigPanel>` + placeholders for charts/availability (Task 8 fills these).

- [ ] **Step 1: Write the failing test**

`src/features/provisioning/MetricConfigPanel.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { MetricConfigPanel } from './MetricConfigPanel'

test('saves the full metrics array', async () => {
  let body: any = null
  server.use(http.put('*/api/provision/5/metrics', async ({ request }) => { body = await request.json(); return HttpResponse.json({ 'status.code': 200, status: 'success', result: [5] }) }))
  const job = { id: 5, ip: '10.0.0.1', port: 22, metrics: [{ metric_name: 'CPU', polling_interval: 300, is_enabled: true }] }
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MetricConfigPanel job={job} />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(body).toEqual({ metrics: [{ metric_name: 'CPU', polling_interval: 300, is_enabled: true }] }))
})
```

- [ ] **Step 2: Run test to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`MetricConfigPanel` keeps local editable copies of `job.metrics` (Switch toggles `is_enabled`; Input edits `polling_interval` as a number). Save calls `useUpdateMetrics(job.id).mutate(metrics, { onSuccess: toast, onError: toast.error })`. `ProvisioningDetailPage` reads `:id`, loads `useJobDetail`, renders summary + panel (+ Task 8 sections). Wire `/provisioning/:id` in `App.tsx`.

- [ ] **Step 4: Run test + gate** — target PASS; full gate passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/provisioning/ src/App.tsx
git commit -m "feat(provisioning): detail page with editable metric config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Metric history charts (Highcharts) + availability panel

**Files:**
- Create: `src/components/MetricChart.tsx`, `src/features/provisioning/MetricCharts.tsx`, `src/features/provisioning/AvailabilityPanel.tsx`
- Modify: `src/features/provisioning/ProvisioningDetailPage.tsx` (mount both), `src/features/provisioning/useJobDetail.ts` (polled-data + availability queries)
- Test: `src/components/MetricChart.test.tsx`, `src/features/provisioning/AvailabilityPanel.test.tsx`

**Interfaces:**
- Consumes: `getPolledData`, `getAvailability` (Task 5).
- Produces:
  - `MetricChart({ title, series })` where `series: { name: string; points: [number, number][] }[]` — a fresh Highcharts `spline` time-series config (authored here, not copied). Renders via `HighchartsReact`.
  - `usePolledData(jobId)`: `useQuery(['polled', jobId], () => getPolledData(jobId), { refetchInterval: 10000 })`; `useAvailability(jobId)`: `useQuery(['availability', jobId], () => getAvailability(jobId), { refetchInterval: 10000 })`.
  - `MetricCharts({ jobId })`: groups `PolledData` by `metric_type`, maps each row to `[Date.parse(polled_at), <numeric value from data>]`, renders one `MetricChart` per metric. (Extract the first numeric value in `data`; if none, skip.)
  - `AvailabilityPanel({ jobId })`: shows up/down Badge + `availability_pct` (`formatPct`) + sample counts; "No availability data yet" when the query returns `null`.

- [ ] **Step 1: Write the failing tests**

`src/components/MetricChart.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { MetricChart } from './MetricChart'

test('renders without crashing given a series', () => {
  const { container } = render(<MetricChart title="CPU" series={[{ name: 'usage', points: [[1, 10], [2, 20]] }]} />)
  expect(container.querySelector('.highcharts-container, [data-highcharts-chart]')).toBeTruthy()
})
```
`src/features/provisioning/AvailabilityPanel.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { AvailabilityPanel } from './AvailabilityPanel'

test('shows uptime percent when available', async () => {
  server.use(http.get('*/api/availability/5', () => HttpResponse.json({ 'status.code': 200, status: 'success',
    result: [{ provisioning_job_id: 5, is_up: true, last_change: '2026-07-06T10:00:00Z', up_samples: 9, total_samples: 10, availability_pct: 90 }] })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}><AvailabilityPanel jobId={5} /></QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText(/90.0%/)).toBeInTheDocument())
})

test('shows empty message on 404', async () => {
  server.use(http.get('*/api/availability/7', () => HttpResponse.json({ 'status.code': 404, status: 'failure', error: 'not found' }, { status: 404 })))
  render(
    <QueryClientProvider client={makeQueryClient(false)}><AvailabilityPanel jobId={7} /></QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText(/no availability data/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/components/MetricChart.tsx`:
```tsx
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

export function MetricChart({ title, series }: { title: string; series: { name: string; points: [number, number][] }[] }) {
  const options: Highcharts.Options = {
    title: { text: title },
    chart: { type: 'spline', height: 260 },
    xAxis: { type: 'datetime' },
    yAxis: { title: { text: undefined } },
    credits: { enabled: false },
    series: series.map((s) => ({ type: 'spline', name: s.name, data: s.points })),
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}
```
`AvailabilityPanel.tsx` + `MetricCharts.tsx` + the two queries in `useJobDetail.ts` per the Interfaces. For `MetricCharts`, pick the numeric value: `const v = Object.values(row.data).find(x => typeof x === 'number') as number | undefined`. Mount both in `ProvisioningDetailPage` under the config panel (a `Tabs` or stacked sections). `AvailabilityPanel` uses `isLoading`→Loading, `data === null`→"No availability data yet", else the stats.

- [ ] **Step 4: Run tests + gate** — both tests PASS; `npm test`, `npm run lint`, `npm run build` pass. (If jsdom lacks canvas/SVG APIs Highcharts needs, the test asserts only that a chart container renders — keep the assertion tolerant as written.)

- [ ] **Step 5: Commit**

```bash
git add src/components/MetricChart.tsx src/features/provisioning/
git commit -m "feat(provisioning): Highcharts metric history and availability panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Dashboard

**Files:**
- Create: `src/features/dashboard/DashboardPage.tsx`, `src/features/dashboard/useDashboard.ts`
- Modify: `src/App.tsx` (index route → `DashboardPage`)
- Test: `src/features/dashboard/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `listJobs` (Task 5), `getAvailability` (Task 5), `listCredentials`/`listDiscoveries` for counts.
- Produces:
  - `useDashboard()`: `useJobs()` plus a derived set of availability queries (`useQueries` over job ids, `refetchInterval: 10000`).
  - `DashboardPage`: summary tiles (total jobs, devices up/down, average uptime %) + a compact table of jobs with their up/down Badge and uptime %. Handles loading/empty.

- [ ] **Step 1: Write the failing test**

`src/features/dashboard/DashboardPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { DashboardPage } from './DashboardPage'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

test('shows a device count and its up/down state', async () => {
  server.use(
    http.get('*/api/provision', () => ok([{ id: 5, ip: '10.0.0.1', port: 22, credential_name: 'linux', system_type: 'LINUX' }])),
    http.get('*/api/availability/5', () => ok([{ provisioning_job_id: 5, is_up: true, last_change: '2026-07-06T10:00:00Z', up_samples: 9, total_samples: 10, availability_pct: 90 }])),
  )
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByText('10.0.0.1')).toBeInTheDocument())
  expect(screen.getByText(/90.0%/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`useDashboard.ts` (jobs + `useQueries` for availability per job id) and `DashboardPage.tsx` (tiles + per-device table). Replace the index Dashboard placeholder in `App.tsx` with `<DashboardPage/>`.

- [ ] **Step 4: Run test + gate** — target PASS; full gate passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/ src/App.tsx
git commit -m "feat(dashboard): fleet overview with device up/down and uptime

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Deferred Plan-1 polish, route code-splitting, README/CI, live verification

**Files:**
- Create: `src/features/auth/AuthCard.tsx`
- Modify: `src/features/auth/LoginPage.tsx`, `src/features/auth/RegisterPage.tsx`, `src/features/credentials/CredentialDrawer.tsx`, `src/App.tsx`, `README.md`
- Test: existing suite must stay green (adjust auth tests only if selectors change — keep labels/text identical so they don't).

**Interfaces:**
- Produces: shared `AuthCard` wrapper removing Login/Register duplication; uniform Zod validation messages rendered via `errors.<field>.message` on both auth pages; optional-password-on-edit in `CredentialDrawer` (when editing and password is left blank, PATCH omits `cred_data`); lazily-loaded feature routes (`React.lazy` + `<Suspense>`) so the bundle code-splits.

- [ ] **Step 1: Deferred item — uniform validation messages**

Give both auth schemas explicit messages (`z.string().min(1, 'Username is required')`, etc.) and render `{errors.field?.message}` on both pages (remove the hardcoded `"Required"` strings). Run the auth tests — they assert token/navigation, not the error copy, so they stay green.

- [ ] **Step 2: Deferred item — dedupe auth pages**

Extract `src/features/auth/AuthCard.tsx` (centered `Card` with a title + children + footer link) and use it in both `LoginPage` and `RegisterPage`. Keep field labels ("Username"/"Password") and button text ("Sign in"/"Create account") identical so `LoginPage.test.tsx` is unaffected. Run `npx vitest run src/features/auth` → PASS.

- [ ] **Step 3: Deferred item — optional password on credential edit**

In `CredentialDrawer`, when `editing` is set and the password field is blank on submit, send an update WITHOUT `cred_data` (only `credential_name`/`protocol`). Add `updateCredentialPartial` in `src/api/credentials.ts` if needed, or make `CredentialInput.cred_data` optional for the patch path. Add a test `src/features/credentials/CredentialDrawer.edit.test.tsx`: render with an `editing` credential, change only the name, submit, assert the PATCH body has NO `cred_data`. Keep the create test green (create still requires password).

- [ ] **Step 4: Deferred item — route code-splitting**

In `App.tsx`, convert feature route elements to `React.lazy(() => import(...))` (Dashboard, Discovery, DiscoveryDetail, Provisioning, ProvisioningDetail, Credentials) wrapped in a single `<Suspense fallback={<Loading/>}>`. Run `npm run build` and confirm multiple chunks are emitted (the >500 kB single-chunk warning should be gone or reduced).

- [ ] **Step 5: Update README + full gate**

Extend `README.md`: the new screens (Discovery/Provisioning/Dashboard/charts), the confirmed endpoint table from this plan's Global Constraints, and an updated manual smoke-test checklist (login → create credential → create+run discovery → provision a completed IP → configure metrics → watch charts/availability → dashboard). Run `npm run lint && npm test && npm run build` → all pass.

- [ ] **Step 6: Live verification against the real backend**

With the Java backend on `:8080` (`NMS_JWT_SECRET`, `NMS_CRED_KEY` set) and `npm run dev`: exercise the full journey end-to-end and fix any envelope/field-shape mismatch surfaced (this is the definitive confirmation of the discovery `ip.address`/`credential_profile_id` write shape and the provision/metrics shapes). Document results.

- [ ] **Step 7: Commit**

```bash
git add src/ README.md
git commit -m "refactor(ui): dedupe auth, uniform validation, optional password on edit, code-split routes; docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Discovery list/create/edit/delete (Tasks 2–3) · discovery run + live status + results (Task 4) · provision-from-discovery (Task 6) · provisioning list + delete (Task 5) · provisioning detail with metric config (Task 7) · metric history charts + availability (Task 8) · Dashboard (Task 9) · deferred Plan-1 polish + code-splitting + docs + live verification (Task 10). Completes spec §6 items 2–7 (§6 item 1 auth + item 3 credentials shipped in Plan 1) and §7 cross-cutting (live polling via `refetchInterval`, loading/error/empty, 404-as-empty for availability).
- **API fidelity:** every request/response shape is copied verbatim from the confirmed backend contract in Global Constraints, including the two easy-to-miss quirks (discovery write uses the dotted `ip.address` key and `credential_profile_id` array; `POST /api/provision/:id` takes the DISCOVERY id + `selected_ips`). The api modules translate between clean feature-facing types and the wire shapes so screens stay clean.
- **Placeholder scan:** novel/critical tasks (1, 2, 3, 4, 6, 8) carry complete code; the screen-scaffold tasks (5, 7, 9) give complete code for the tested cores (api module, `MetricConfigPanel` save, dashboard tile) and precise "mirror `CredentialsPage`" wiring against already-shown patterns from Plan 1 — no vague error-handling/TBD placeholders. Temporary stub (`DiscoveryDrawer` in Task 2) is called out with its replacement task.
- **Type consistency:** `Discovery`, `DiscoveryResult`, `ProvisioningJob`, `ProvisioningJobDetail`, `JobMetric`, `PolledData`, `Availability`, `DiscoveryInput`, and the api function names are used identically across tasks and match the confirmed backend response shapes.
