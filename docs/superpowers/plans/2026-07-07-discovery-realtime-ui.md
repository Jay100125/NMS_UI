# Discovery Realtime UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-screen multi-protocol discovery flow with live SockJS progress (ping → port → plugin), a per-device polled-data grid, and a slim dashboard without availability averaging.

**Architecture:** A lazy singleton event-bus client (`src/lib/eventbus.ts`) connects to the backend's SockJS bridge at `/eventbus?access_token=<jwt>` and exposes `subscribe(address, handler)`. A pure reducer (`src/features/discovery/progress.ts`) turns `nms.discovery.<id>` events plus persisted results into progress-page state. Discovery becomes four routes (form / detail / progress / result); the drawer is deleted.

**Tech Stack:** React 19, TypeScript, Vite 8 (dev proxy to :8080), TanStack Query, RHF+zod (zod v4), shadcn/ui, Highcharts, Vitest+RTL+MSW, `@vertx/eventbus-bridge-client.js` + `sockjs-client`.

**Spec:** `/home/jay-patel/personal/Lite-NMS/docs/superpowers/specs/2026-07-07-discovery-realtime-redesign-design.md`
**Backend contract (implemented by the backend plan):**
- `POST/PUT /api/discovery` body gains required `plugin_type: 'LINUX'|'SNMP'|'WINRM'`; `GET` rows include it.
- Credential `cred_data` for SNMP is `{community}` (write) — LINUX/WINRM stay `{user,password}`.
- SockJS bridge `/eventbus`, outbound address `nms.discovery.<id>`, JWT via `?access_token=`.
- Events: `{type:'state',status:'RUNNING'|'COMPLETED'|'FAILED',message?}`, `{type:'targets',total,ips[]}`, `{type:'progress',ip,stage:'PING'|'PORT'|'PLUGIN',progress,status,message?}` (PING/PORT status `ok|failed`; PLUGIN status `COMPLETED|FAILED`; SNMP has no PORT stage, PING ok = 50).

## Global Constraints

- Commit as Jay Patel <jaypatel100125@gmail.com> (repo-local config).
- IP boundary: `/home/jay-patel/workspace/UI` is reference-only; never copy code.
- `npm run lint` = `oxlint && tsc -b --noEmit` — must pass before every commit; `npm test` (vitest) must be green.
- Tailwind is pinned v3; shadcn CLI pinned 2.10.0 (add components with `npx shadcn@2.10.0 add <name>` only if missing).
- All new routes stay inside the existing lazy/`Suspense` structure in `src/App.tsx`.
- Never store the JWT anywhere new — read it from `useAuthStore.getState().token`.

---

### Task 1: Event-bus client (`src/lib/eventbus.ts`)

**Files:**
- Create: `src/lib/eventbus.ts`
- Create: `src/types/vertx-eventbus.d.ts`
- Modify: `vite.config.ts` (proxy), `package.json` (deps)
- Test: Create `src/lib/eventbus.test.ts`

**Interfaces:**
- Produces: `subscribe(address: string, onMessage: (body: unknown) => void, onStatus?: (connected: boolean) => void): () => void` — lazily opens one shared EventBus connection, registers a handler, returns an unsubscribe function that also closes the bus when no handlers remain. `_resetForTests()` clears the singleton.

- [ ] **Step 1: Install deps and proxy**

```bash
npm install @vertx/eventbus-bridge-client.js sockjs-client
```

In `vite.config.ts`, add to `server.proxy`:

```ts
      '/eventbus': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
```

- [ ] **Step 2: Ambient types** — `src/types/vertx-eventbus.d.ts`:

```ts
declare module '@vertx/eventbus-bridge-client.js' {
  interface EventBusMessage { body: unknown }
  export default class EventBus {
    constructor(url: string, options?: Record<string, unknown>)
    onopen: (() => void) | null
    onclose: (() => void) | null
    enableReconnect(enable: boolean): void
    registerHandler(address: string, callback: (err: Error | null, message: EventBusMessage) => void): void
    unregisterHandler(address: string, callback: (err: Error | null, message: EventBusMessage) => void): void
    close(): void
  }
}
```

- [ ] **Step 3: Write the failing test** — `src/lib/eventbus.test.ts` (mock the bridge client class):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const instances: MockBus[] = []
class MockBus {
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  handlers = new Map<string, (err: null, msg: { body: unknown }) => void>()
  url: string
  constructor(url: string) { this.url = url; instances.push(this) }
  enableReconnect = vi.fn()
  registerHandler(address: string, cb: (err: null, msg: { body: unknown }) => void) { this.handlers.set(address, cb) }
  unregisterHandler(address: string) { this.handlers.delete(address) }
  close = vi.fn()
}
vi.mock('@vertx/eventbus-bridge-client.js', () => ({ default: MockBus }))
vi.mock('@/stores/auth', () => ({ useAuthStore: { getState: () => ({ token: 'jwt-token' }) } }))

import { subscribe, _resetForTests } from './eventbus'

describe('eventbus', () => {
  beforeEach(() => { instances.length = 0; _resetForTests() })

  it('connects lazily with the token, delivers bodies, and closes when empty', () => {
    const got: unknown[] = []
    const unsub = subscribe('nms.discovery.7', (body) => got.push(body))

    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('/eventbus?access_token=jwt-token')

    instances[0].onopen?.()
    instances[0].handlers.get('nms.discovery.7')?.(null, { body: { type: 'state', status: 'RUNNING' } })
    expect(got).toEqual([{ type: 'state', status: 'RUNNING' }])

    unsub()
    expect(instances[0].close).toHaveBeenCalled()
  })

  it('reports connection status transitions', () => {
    const statuses: boolean[] = []
    subscribe('nms.discovery.9', () => {}, (up) => statuses.push(up))
    instances[0].onopen?.()
    instances[0].onclose?.()
    expect(statuses).toEqual([true, false])
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/lib/eventbus.test.ts`
Expected: FAIL — `./eventbus` module not found.

- [ ] **Step 5: Implement `src/lib/eventbus.ts`:**

```ts
import EventBus from '@vertx/eventbus-bridge-client.js'
import { useAuthStore } from '@/stores/auth'
import { apiBase } from '@/lib/env'

type Handler = (body: unknown) => void
type StatusHandler = (connected: boolean) => void

interface Subscription { address: string; onMessage: Handler; onStatus?: StatusHandler; cb: (err: Error | null, msg: { body: unknown }) => void }

let bus: EventBus | null = null
let connected = false
const subscriptions = new Set<Subscription>()

function ensureBus(): EventBus {
  if (bus) return bus
  const token = useAuthStore.getState().token ?? ''
  bus = new EventBus(`${apiBase()}/eventbus?access_token=${encodeURIComponent(token)}`, { vertxbus_ping_interval: 5000 })
  bus.enableReconnect(true)
  bus.onopen = () => {
    connected = true
    // (Re)register all handlers — the bridge drops them on reconnect.
    for (const s of subscriptions) bus!.registerHandler(s.address, s.cb)
    for (const s of subscriptions) s.onStatus?.(true)
  }
  bus.onclose = () => {
    connected = false
    for (const s of subscriptions) s.onStatus?.(false)
  }
  return bus
}

/**
 * Subscribes to an event-bus address over the shared SockJS bridge connection.
 * The connection opens on first subscribe and closes when the last subscriber
 * unsubscribes. Message handlers receive the JSON body only.
 */
export function subscribe(address: string, onMessage: Handler, onStatus?: StatusHandler): () => void {
  const cb = (_err: Error | null, msg: { body: unknown }) => onMessage(msg.body)
  const sub: Subscription = { address, onMessage, onStatus, cb }
  subscriptions.add(sub)
  const b = ensureBus()
  if (connected) {
    b.registerHandler(address, cb)
    onStatus?.(true)
  }
  return () => {
    subscriptions.delete(sub)
    try { b.unregisterHandler(address, cb) } catch { /* bridge may already be closed */ }
    if (subscriptions.size === 0) {
      b.close()
      bus = null
      connected = false
    }
  }
}

/** Test hook: drop the singleton so each test starts from a cold connection. */
export function _resetForTests() {
  bus = null
  connected = false
  subscriptions.clear()
}
```

- [ ] **Step 6: Run to verify pass, lint, commit**

```bash
npx vitest run src/lib/eventbus.test.ts   # PASS
npm run lint && npm test
git add src/lib/eventbus.ts src/lib/eventbus.test.ts src/types/vertx-eventbus.d.ts vite.config.ts package.json package-lock.json
git commit -m "feat(eventbus): shared SockJS bridge client with lazy connect and status callbacks"
```

---

### Task 2: Types + API — `plugin_type` and SNMP credentials

**Files:**
- Modify: `src/lib/types.ts`, `src/api/discovery.ts`, `src/api/credentials.ts`
- Test: Create `src/api/discovery.wire.test.ts`

**Interfaces:**
- Produces: `Discovery`/`DiscoveryInput` gain `plugin_type: SystemType`; `toWire` includes it. `CredentialInput.cred_data` becomes `{ user?: string; password?: string; community?: string }`.

- [ ] **Step 1: Write the failing test** — `src/api/discovery.wire.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { api } from './client'
import { createDiscovery } from './discovery'

describe('discovery wire format', () => {
  it('sends dotted ip.address, credential_profile_id array, and plugin_type', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { status: 'success', result: [1] } } as never)
    await createDiscovery({ discovery_profile_name: 'd', ip: '10.0.0.0/24', port: 161, credential_profile_ids: [3], plugin_type: 'SNMP' })
    expect(post).toHaveBeenCalledWith('/api/discovery', {
      discovery_profile_name: 'd',
      'ip.address': '10.0.0.0/24',
      port: 161,
      credential_profile_id: [3],
      plugin_type: 'SNMP',
    })
    post.mockRestore()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/api/discovery.wire.test.ts` → FAIL (TS error: `plugin_type` not in `DiscoveryInput`).

- [ ] **Step 3: Implement.** In `src/lib/types.ts` change:

```ts
export interface Discovery { id: number; discovery_profile_name: string; ip: string; port: number; plugin_type: SystemType; status: 'PENDING'|'RUNNING'|'COMPLETED'|'FAILED'; credential_profile_ids: number[] }
```

In `src/api/discovery.ts` add `plugin_type: SystemType` to `DiscoveryInput` (import `SystemType`), and add `plugin_type: input.plugin_type,` to `toWire`'s returned object.

In `src/api/credentials.ts`, widen the input type so SNMP writes `{community}` (find the existing `cred_data` input type and replace with):

```ts
export interface CredDataInput { user?: string; password?: string; community?: string }
```

and use `CredDataInput` wherever the create/update payload types the `cred_data` field.

- [ ] **Step 4: Fix compile fallout** — `DiscoveryDrawer.tsx` still builds a payload without `plugin_type`; add `plugin_type: 'LINUX' as const` to its payload object (temporary — the drawer is deleted in Task 4; this keeps the build green between tasks). Run `npm run lint` and fix any other missing-field errors the same way (always default `'LINUX'`).

- [ ] **Step 5: Verify + commit**

```bash
npx vitest run src/api/discovery.wire.test.ts && npm run lint && npm test
git add src/lib/types.ts src/api/discovery.ts src/api/credentials.ts src/api/discovery.wire.test.ts src/features/discovery/DiscoveryDrawer.tsx
git commit -m "feat(api): plugin_type on discovery wire format; SNMP community cred input"
```

---

### Task 3: Type-driven credential form (SNMP community)

**Files:**
- Modify: `src/features/credentials/CredentialDrawer.tsx`
- Test: Modify `src/features/credentials/CredentialDrawer.test.tsx` (add SNMP case)

**Interfaces:**
- Produces: choosing `system_type = SNMP` swaps user/password inputs for a single `community` input; payload becomes `cred_data: { community }`. LINUX/WINRM behavior unchanged (including the edit-mode leave-blank-to-keep rule, applied to community too).

- [ ] **Step 1: Write the failing test** — add to `CredentialDrawer.test.tsx` (follow the file's existing render/submit helpers):

```tsx
  it('shows a community field for SNMP and submits {community}', async () => {
    const user = userEvent.setup()
    renderDrawer(null) // existing helper rendering <CredentialDrawer open editing={null}> with providers/MSW
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'SNMP' }))

    expect(screen.queryByLabelText('User')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Community'), 'public')
    await user.type(screen.getByLabelText('Name'), 'snmp-cred')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(lastCreateBody()).toMatchObject({
      protocol: 'SNMP',
      cred_data: { community: 'public' },
    }))
  })
```

(`renderDrawer`/`lastCreateBody` — reuse the file's existing MSW capture pattern; if it captures via `server.use`, record the request body into a variable the same way the existing create test does.)

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/features/credentials/CredentialDrawer.test.tsx` → FAIL (no Community field).

- [ ] **Step 3: Implement in `CredentialDrawer.tsx`.** Extend the schema factory — SNMP requires community, others require user/password (same edit-mode looseness):

```ts
function makeSchema(isEditing: boolean, systemType: SystemType) {
  const base = z.object({
    credential_name: z.string().min(1, 'Name is required'),
    system_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
    user: z.string(),
    password: z.string(),
    community: z.string(),
  })
  return base.superRefine((v, ctx) => {
    if (systemType === 'SNMP') {
      if (!isEditing && v.community.length === 0)
        ctx.addIssue({ code: 'custom', path: ['community'], message: 'Community is required' })
      return
    }
    if (!isEditing) {
      if (v.user.length === 0) ctx.addIssue({ code: 'custom', path: ['user'], message: 'User is required' })
      if (v.password.length === 0) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' })
      return
    }
    if ((v.user.length > 0) !== (v.password.length > 0))
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Enter both user and password to change credentials' })
  })
}
```

Update the resolver to read the live type: `zodResolver(makeSchema(!!editingRef.current, values.system_type as SystemType))(values, context, options)`. Watch the type for rendering: `const systemType = watch('system_type')`. Render conditionally where the user/password inputs are:

```tsx
          {systemType === 'SNMP' ? (
            <div><Label htmlFor="community">Community</Label><Input id="community" {...register('community')} />
              {errors.community && <p className="text-xs text-red-600">{errors.community.message}</p>}</div>
          ) : (
            <> {/* existing User + Password fields unchanged */} </>
          )}
```

Reset must include `community: ''`. Payload logic:

```ts
    const credData = v.system_type === 'SNMP'
      ? (v.community ? { community: v.community } : null)
      : (v.password ? { user: v.user, password: v.password } : null)
    const payload = credData
      ? { credential_name: v.credential_name, protocol: v.system_type, cred_data: credData }
      : { credential_name: v.credential_name, protocol: v.system_type }
```

(create always has `credData` non-null thanks to the schema; edit keeps the omit-to-preserve behavior for both shapes.)

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run src/features/credentials && npm run lint && npm test
git add src/features/credentials/
git commit -m "feat(credentials): type-driven form with SNMP community field"
```

---

### Task 4: Full-page discovery form (`/discovery/new`, `/discovery/:id/edit`)

**Files:**
- Create: `src/features/discovery/DiscoveryFormPage.tsx`
- Create: `src/features/discovery/targetSchema.ts`
- Delete: `src/features/discovery/DiscoveryDrawer.tsx` (and its tests)
- Modify: `src/App.tsx`, `src/features/discovery/DiscoveryPage.tsx`
- Test: Create `src/features/discovery/targetSchema.test.ts`, `src/features/discovery/DiscoveryFormPage.test.tsx`

**Interfaces:**
- Produces: `targetSchema.ts` exports `TARGET_TYPES = ['IP','RANGE','CIDR'] as const`, `targetError(type, value): string | null`, `DEFAULT_PORTS: Record<SystemType, number>` (`{LINUX:22, SNMP:161, WINRM:5985}`). `DiscoveryFormPage` handles both create and edit (reads `:id` param).
- Consumes: `DiscoveryInput` with `plugin_type` (Task 2).

- [ ] **Step 1: Write the failing validation test** — `targetSchema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { targetError, DEFAULT_PORTS } from './targetSchema'

describe('targetError', () => {
  it('validates single IPs', () => {
    expect(targetError('IP', '192.168.1.1')).toBeNull()
    expect(targetError('IP', '999.1.1.1')).toBeTruthy()
    expect(targetError('IP', '192.168.1.0/24')).toBeTruthy()
  })
  it('validates ranges', () => {
    expect(targetError('RANGE', '192.168.1.10-192.168.1.120')).toBeNull()
    expect(targetError('RANGE', '192.168.1.10 - 192.168.1.120')).toBeNull()
    expect(targetError('RANGE', '192.168.1.10')).toBeTruthy()
    expect(targetError('RANGE', '192.168.1.120-192.168.1.10')).toBeTruthy() // start > end
  })
  it('validates CIDR', () => {
    expect(targetError('CIDR', '192.168.1.0/24')).toBeNull()
    expect(targetError('CIDR', '192.168.1.0/33')).toBeTruthy()
    expect(targetError('CIDR', '192.168.1.0')).toBeTruthy()
  })
})

it('default ports per type', () => {
  expect(DEFAULT_PORTS).toEqual({ LINUX: 22, SNMP: 161, WINRM: 5985 })
})
```

- [ ] **Step 2: Run to verify it fails** — module missing.

- [ ] **Step 3: Implement `targetSchema.ts`:**

```ts
import type { SystemType } from '@/lib/types'

export const TARGET_TYPES = ['IP', 'RANGE', 'CIDR'] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export const DEFAULT_PORTS: Record<SystemType, number> = { LINUX: 22, SNMP: 161, WINRM: 5985 }

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`)

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0)
}

/** Validates the target value for its type; returns an error message or null. Matches the backend's resolveIpAddresses grammar. */
export function targetError(type: TargetType, value: string): string | null {
  const v = value.trim()
  if (!v) return 'Target is required'
  if (type === 'IP') {
    return IPV4.test(v) ? null : 'Enter a valid IPv4 address, e.g. 192.168.1.1'
  }
  if (type === 'RANGE') {
    const parts = v.split(/\s*-\s*/)
    if (parts.length !== 2 || !IPV4.test(parts[0]) || !IPV4.test(parts[1]))
      return 'Enter a range like 192.168.1.10-192.168.1.120'
    if (ipToNum(parts[0]) > ipToNum(parts[1])) return 'Range start must be ≤ end'
    return null
  }
  const [base, mask, extra] = v.split('/')
  if (extra !== undefined || !base || mask === undefined) return 'Enter CIDR like 192.168.1.0/24'
  if (!IPV4.test(base)) return 'Invalid CIDR base address'
  const bits = Number(mask)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return 'CIDR mask must be 0-32'
  return null
}

/** Guesses the target type of a stored ip string (for edit prefill). */
export function inferTargetType(ip: string): TargetType {
  if (ip.includes('/')) return 'CIDR'
  if (ip.includes('-')) return 'RANGE'
  return 'IP'
}
```

- [ ] **Step 4: Write the failing page test** — `DiscoveryFormPage.test.tsx` (reuse the provider/MSW harness from `CredentialsPage.test.tsx`):

```tsx
// Renders /discovery/new with MemoryRouter + QueryClientProvider + MSW handlers for
// GET /api/credential (two creds: one LINUX id=1, one SNMP id=2).
it('filters credentials by device type and defaults the port', async () => {
  const user = userEvent.setup()
  renderAt('/discovery/new')

  // default LINUX: port 22, only the LINUX credential offered
  expect(await screen.findByDisplayValue('22')).toBeInTheDocument()
  expect(screen.getByText('linux-cred')).toBeInTheDocument()
  expect(screen.queryByText('snmp-cred')).not.toBeInTheDocument()

  await user.click(screen.getByRole('combobox', { name: /device type/i }))
  await user.click(screen.getByRole('option', { name: 'SNMP' }))

  expect(await screen.findByDisplayValue('161')).toBeInTheDocument()
  expect(screen.getByText('snmp-cred')).toBeInTheDocument()
  expect(screen.queryByText('linux-cred')).not.toBeInTheDocument()
})

it('rejects an invalid CIDR before submitting', async () => {
  const user = userEvent.setup()
  renderAt('/discovery/new')
  await user.click(screen.getByRole('combobox', { name: /target type/i }))
  await user.click(screen.getByRole('option', { name: 'CIDR' }))
  await user.type(screen.getByLabelText('Target'), '10.0.0.0/40')
  await user.type(screen.getByLabelText('Name'), 'bad')
  await user.click(screen.getByRole('button', { name: /save/i }))
  expect(await screen.findByText(/mask must be 0-32/i)).toBeInTheDocument()
})
```

- [ ] **Step 5: Implement `DiscoveryFormPage.tsx`:**

```tsx
import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loading } from '@/components/states'
import { useCredentials } from '@/features/credentials/useCredentials'
import { useCreateDiscovery, useUpdateDiscovery } from './useDiscovery'
import { useDiscoveryDetail } from './useDiscoveryDetail'
import { TARGET_TYPES, type TargetType, targetError, inferTargetType, DEFAULT_PORTS } from './targetSchema'
import type { SystemType } from '@/lib/types'

const schema = z.object({
  discovery_profile_name: z.string().min(1, 'Required'),
  plugin_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
  target_type: z.enum(TARGET_TYPES),
  ip: z.string().min(1, 'Required'),
  port: z.coerce.number().int().min(1).max(65535),
  credential_profile_ids: z.array(z.number()).min(1, 'Select at least one credential'),
}).superRefine((v, ctx) => {
  const err = targetError(v.target_type as TargetType, v.ip)
  if (err) ctx.addIssue({ code: 'custom', path: ['ip'], message: err })
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function DiscoveryFormPage() {
  const { id } = useParams<{ id: string }>()
  const editingId = id ? Number(id) : null
  const navigate = useNavigate()
  const detail = useDiscoveryDetail(editingId ?? -1, { enabled: editingId !== null })
  const { data: credentials } = useCredentials()
  const create = useCreateDiscovery()
  const update = useUpdateDiscovery()

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({
      resolver: zodResolver(schema),
      defaultValues: { plugin_type: 'LINUX', target_type: 'IP', port: 22, credential_profile_ids: [] },
    })

  const pluginType = watch('plugin_type') as SystemType

  // Prefill on edit once the profile loads.
  useEffect(() => {
    if (editingId !== null && detail.data) {
      reset({
        discovery_profile_name: detail.data.discovery_profile_name,
        plugin_type: detail.data.plugin_type,
        target_type: inferTargetType(detail.data.ip),
        ip: detail.data.ip,
        port: detail.data.port,
        credential_profile_ids: detail.data.credential_profile_ids ?? [],
      })
    }
  }, [editingId, detail.data, reset])

  // Device type drives the default port and clears cross-type credential picks.
  const onTypeChange = (t: SystemType) => {
    setValue('plugin_type', t)
    setValue('port', DEFAULT_PORTS[t])
    setValue('credential_profile_ids', [])
  }

  const matching = useMemo(() => (credentials ?? []).filter((c) => c.system_type === pluginType), [credentials, pluginType])

  const onSubmit = (v: FormOutput) => {
    const payload = {
      discovery_profile_name: v.discovery_profile_name,
      ip: v.ip.trim(),
      port: v.port,
      credential_profile_ids: v.credential_profile_ids,
      plugin_type: v.plugin_type as SystemType,
    }
    const done = {
      onSuccess: () => { toast.success('Saved'); navigate('/discovery') },
      onError: (e: unknown) => toast.error((e as Error).message),
    }
    if (editingId !== null) update.mutate({ id: editingId, input: payload }, done)
    else create.mutate(payload, done)
  }

  if (editingId !== null && detail.isLoading) return <Loading />

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">{editingId !== null ? 'Edit discovery' : 'New discovery'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div><Label htmlFor="discovery_profile_name">Name</Label><Input id="discovery_profile_name" {...register('discovery_profile_name')} />
          {errors.discovery_profile_name && <p className="text-xs text-red-600">{errors.discovery_profile_name.message}</p>}</div>

        <div>
          <Label id="plugin-type-label">Device type</Label>
          <Controller control={control} name="plugin_type" render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => onTypeChange(v as SystemType)}>
              <SelectTrigger aria-labelledby="plugin-type-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LINUX">LINUX</SelectItem>
                <SelectItem value="SNMP">SNMP</SelectItem>
                <SelectItem value="WINRM">WINRM</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label id="target-type-label">Target type</Label>
            <Controller control={control} name="target_type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-labelledby="target-type-label"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">IP</SelectItem>
                  <SelectItem value="RANGE">IP Range</SelectItem>
                  <SelectItem value="CIDR">CIDR</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="ip">Target</Label>
            <Input id="ip" placeholder="192.168.1.1 / 192.168.1.10-192.168.1.120 / 192.168.1.0/24" {...register('ip')} />
            {errors.ip && <p className="text-xs text-red-600">{errors.ip.message}</p>}
          </div>
        </div>

        <div><Label htmlFor="port">Port</Label><Input id="port" type="number" {...register('port')} />
          {errors.port && <p className="text-xs text-red-600">{errors.port.message}</p>}</div>

        <div>
          <Label>Credentials ({pluginType})</Label>
          <Controller control={control} name="credential_profile_ids" render={({ field }) => (
            <div className="space-y-2">
              {matching.length === 0 && <p className="text-sm text-muted-foreground">No {pluginType} credentials — create one first.</p>}
              {matching.map((c) => {
                const checked = field.value.includes(c.id)
                const inputId = `credential-${c.id}`
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <Checkbox id={inputId} checked={checked}
                      onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />
                    <Label htmlFor={inputId} className="font-normal">{c.credential_name}</Label>
                  </div>
                )
              })}
            </div>
          )} />
          {errors.credential_profile_ids && <p className="text-xs text-red-600">{errors.credential_profile_ids.message}</p>}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending || update.isPending}>Save</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/discovery')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
```

`useDiscoveryDetail` gains an options param — change in `useDiscoveryDetail.ts`:

```ts
export function useDiscoveryDetail(id: number, opts?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['discovery', id], queryFn: () => getDiscovery(id), enabled: opts?.enabled ?? true })
}
```

- [ ] **Step 6: Delete the drawer, rewire the list page.** Delete `DiscoveryDrawer.tsx`, `DiscoveryDrawer.test.tsx` (and any drawer edit tests). In `DiscoveryPage.tsx`: remove drawer state/import; "New discovery" button → `navigate('/discovery/new')`; row Edit action → `navigate(`/discovery/${d.id}/edit`)`. Add a `plugin_type` Badge column. Migrate any still-valuable drawer test assertions (create-payload shape) into `DiscoveryFormPage.test.tsx`.

- [ ] **Step 7: Add routes in `App.tsx`:**

```tsx
const DiscoveryFormPage = lazy(() => import('@/features/discovery/DiscoveryFormPage').then((m) => ({ default: m.DiscoveryFormPage })))
```

```tsx
          <Route path="/discovery/new" element={<DiscoveryFormPage />} />
          <Route path="/discovery/:id/edit" element={<DiscoveryFormPage />} />
```

(place BEFORE `/discovery/:id` so `new` never matches as an id — React Router v7 ranks static above dynamic anyway, but keep the order explicit.)

- [ ] **Step 8: Verify + commit**

```bash
npx vitest run src/features/discovery && npm run lint && npm test
git add -A src/features/discovery src/App.tsx
git commit -m "feat(discovery): full-page create/edit form with device type and IP/range/CIDR targets"
```

---

### Task 5: Progress reducer (`progress.ts`)

**Files:**
- Create: `src/features/discovery/progress.ts`
- Test: Create `src/features/discovery/progress.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ProgressRow { ip: string; stage: 'PING'|'PORT'|'PLUGIN'|null; progress: number; status: 'pending'|'ok'|'failed'|'completed'; message?: string }
export interface ProgressState { runState: 'IDLE'|'RUNNING'|'COMPLETED'|'FAILED'; runMessage?: string; rows: Record<string, ProgressRow> }
export const initialProgress: ProgressState
export function reduceProgress(state: ProgressState, event: unknown): ProgressState   // applies one bridge event
export function seedFromResults(state: ProgressState, results: DiscoveryResult[], profileStatus: string): ProgressState
export function summarize(state: ProgressState): { total: number; discovered: number; failed: number; overallPct: number }
```

- [ ] **Step 1: Write the failing test** — `progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { initialProgress, reduceProgress, seedFromResults, summarize } from './progress'
import type { DiscoveryResult } from '@/lib/types'

const apply = (events: unknown[]) => events.reduce(reduceProgress, initialProgress)

describe('reduceProgress', () => {
  it('walks an IP through ping → port → plugin success', () => {
    const s = apply([
      { type: 'state', status: 'RUNNING' },
      { type: 'targets', total: 2, ips: ['10.0.0.1', '10.0.0.2'] },
      { type: 'progress', ip: '10.0.0.1', stage: 'PING', progress: 33.33, status: 'ok' },
      { type: 'progress', ip: '10.0.0.1', stage: 'PORT', progress: 66.66, status: 'ok' },
      { type: 'progress', ip: '10.0.0.1', stage: 'PLUGIN', progress: 100, status: 'COMPLETED', message: 'Discovery succeeded' },
    ])
    expect(s.runState).toBe('RUNNING')
    expect(s.rows['10.0.0.1']).toMatchObject({ stage: 'PLUGIN', progress: 100, status: 'completed' })
    expect(s.rows['10.0.0.2']).toMatchObject({ status: 'pending', progress: 0 })
    expect(summarize(s)).toEqual({ total: 2, discovered: 1, failed: 0, overallPct: 50 })
  })

  it('marks ping/port failures failed at 100', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.9'] },
      { type: 'progress', ip: '10.0.0.9', stage: 'PING', progress: 100, status: 'failed', message: 'ping failed' },
    ])
    expect(s.rows['10.0.0.9']).toMatchObject({ status: 'failed', message: 'ping failed' })
    expect(summarize(s)).toEqual({ total: 1, discovered: 0, failed: 1, overallPct: 100 })
  })

  it('does not downgrade a completed IP when another credential fails', () => {
    const s = apply([
      { type: 'targets', total: 1, ips: ['10.0.0.5'] },
      { type: 'progress', ip: '10.0.0.5', stage: 'PLUGIN', progress: 100, status: 'COMPLETED' },
      { type: 'progress', ip: '10.0.0.5', stage: 'PLUGIN', progress: 100, status: 'FAILED', message: 'auth failed' },
    ])
    expect(s.rows['10.0.0.5'].status).toBe('completed')
  })

  it('records completion state', () => {
    const s = apply([{ type: 'state', status: 'COMPLETED' }])
    expect(s.runState).toBe('COMPLETED')
  })

  it('ignores malformed events', () => {
    expect(apply([null, 42, { type: 'bogus' }])).toEqual(initialProgress)
  })
})

describe('seedFromResults', () => {
  it('rebuilds terminal rows from persisted results', () => {
    const results = [
      { id: 1, discovery_id: 3, ip: '10.0.0.1', port: 22, msg: 'ok', credential_profile_id: 1, result: 'COMPLETED' },
      { id: 2, discovery_id: 3, ip: '10.0.0.2', port: 22, msg: 'Device unreachable', credential_profile_id: null, result: 'FAILED' },
    ] as DiscoveryResult[]
    const s = seedFromResults(initialProgress, results, 'RUNNING')
    expect(s.runState).toBe('RUNNING')
    expect(s.rows['10.0.0.1'].status).toBe('completed')
    expect(s.rows['10.0.0.2']).toMatchObject({ status: 'failed', message: 'Device unreachable' })
  })
})
```

- [ ] **Step 2: Run to verify it fails** — module missing.

- [ ] **Step 3: Implement `progress.ts`:**

```ts
import type { DiscoveryResult } from '@/lib/types'

export interface ProgressRow {
  ip: string
  stage: 'PING' | 'PORT' | 'PLUGIN' | null
  progress: number
  status: 'pending' | 'ok' | 'failed' | 'completed'
  message?: string
}

export interface ProgressState {
  runState: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  runMessage?: string
  rows: Record<string, ProgressRow>
}

export const initialProgress: ProgressState = { runState: 'IDLE', rows: {} }

function isTerminal(row: ProgressRow): boolean {
  return row.status === 'completed' || row.status === 'failed'
}

/** Applies one bridge event ({type: state|targets|progress}); unknown shapes are ignored. */
export function reduceProgress(state: ProgressState, event: unknown): ProgressState {
  if (typeof event !== 'object' || event === null) return state
  const e = event as Record<string, unknown>

  if (e.type === 'state' && typeof e.status === 'string') {
    return { ...state, runState: e.status as ProgressState['runState'], runMessage: e.message as string | undefined }
  }

  if (e.type === 'targets' && Array.isArray(e.ips)) {
    const rows = { ...state.rows }
    for (const ip of e.ips as string[]) {
      // Seeded terminal rows (page reload) win over the fresh pending row.
      if (!rows[ip]) rows[ip] = { ip, stage: null, progress: 0, status: 'pending' }
    }
    return { ...state, rows }
  }

  if (e.type === 'progress' && typeof e.ip === 'string' && typeof e.progress === 'number') {
    const current = state.rows[e.ip]
    // COMPLETED wins: a later failed credential attempt must not downgrade the row.
    if (current && current.status === 'completed') return state
    const status: ProgressRow['status'] =
      e.status === 'COMPLETED' ? 'completed'
      : e.status === 'FAILED' || e.status === 'failed' ? 'failed'
      : 'ok'
    const row: ProgressRow = {
      ip: e.ip,
      stage: (e.stage as ProgressRow['stage']) ?? null,
      progress: e.progress,
      status,
      message: e.message as string | undefined,
    }
    return { ...state, rows: { ...state.rows, [e.ip]: row } }
  }

  return state
}

/** Rebuilds state from persisted results (page load/reload); live events overlay afterwards. */
export function seedFromResults(state: ProgressState, results: DiscoveryResult[], profileStatus: string): ProgressState {
  const rows = { ...state.rows }
  for (const r of results) {
    const existing = rows[r.ip]
    if (existing && isTerminal(existing)) continue
    rows[r.ip] = {
      ip: r.ip,
      stage: 'PLUGIN',
      progress: 100,
      status: r.result === 'COMPLETED' ? 'completed' : 'failed',
      message: r.msg ?? undefined,
    }
  }
  const runState = profileStatus === 'RUNNING' ? 'RUNNING'
    : profileStatus === 'COMPLETED' ? 'COMPLETED'
    : profileStatus === 'FAILED' ? 'FAILED'
    : state.runState
  return { ...state, runState, rows }
}

export function summarize(state: ProgressState): { total: number; discovered: number; failed: number; overallPct: number } {
  const rows = Object.values(state.rows)
  const total = rows.length
  const discovered = rows.filter((r) => r.status === 'completed').length
  const failed = rows.filter((r) => r.status === 'failed').length
  const overallPct = total === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / total)
  return { total, discovered, failed, overallPct }
}
```

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run src/features/discovery/progress.test.ts && npm run lint && npm test
git add src/features/discovery/progress.ts src/features/discovery/progress.test.ts
git commit -m "feat(discovery): pure progress reducer for live discovery events"
```

---

### Task 6: Progress page (`/discovery/:id/progress`)

**Files:**
- Create: `src/features/discovery/useDiscoveryProgress.ts`
- Create: `src/features/discovery/DiscoveryProgressPage.tsx`
- Modify: `src/App.tsx`
- Test: Create `src/features/discovery/DiscoveryProgressPage.test.tsx`

**Interfaces:**
- Consumes: `subscribe` (Task 1), `progress.ts` (Task 5), `useDiscoveryDetail`/`useDiscoveryResults` hooks.
- Produces: `useDiscoveryProgress(id: number)` → `{ state: ProgressState, summary, live: boolean }`. Page auto-navigates to `/discovery/:id/result` when `runState === 'COMPLETED'`.

- [ ] **Step 1: Write the failing test** — `DiscoveryProgressPage.test.tsx`; mock `@/lib/eventbus` so the test drives events by hand:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

let pushEvent: (body: unknown) => void = () => {}
vi.mock('@/lib/eventbus', () => ({
  subscribe: (_addr: string, onMessage: (b: unknown) => void, onStatus?: (up: boolean) => void) => {
    pushEvent = onMessage
    onStatus?.(true)
    return () => {}
  },
}))

// renderAt('/discovery/3/progress') — MemoryRouter + providers + MSW returning:
//   GET /api/discovery/3 → { status:'RUNNING', ... }, GET /api/discovery/3/result → []
// plus a route for /discovery/3/result rendering a marker element.

it('advances rows and tiles from live events, then navigates to result on completion', async () => {
  renderAt('/discovery/3/progress')

  await screen.findByText(/live/i)   // connected indicator

  pushEvent({ type: 'targets', total: 2, ips: ['10.0.0.1', '10.0.0.2'] })
  expect(await screen.findByText('10.0.0.1')).toBeInTheDocument()
  expect(screen.getByTestId('tile-total')).toHaveTextContent('2')

  pushEvent({ type: 'progress', ip: '10.0.0.1', stage: 'PING', progress: 33.33, status: 'ok' })
  expect(await screen.findByText('PING')).toBeInTheDocument()

  pushEvent({ type: 'progress', ip: '10.0.0.1', stage: 'PLUGIN', progress: 100, status: 'COMPLETED' })
  await waitFor(() => expect(screen.getByTestId('tile-discovered')).toHaveTextContent('1'))

  pushEvent({ type: 'state', status: 'COMPLETED' })
  await waitFor(() => expect(screen.getByTestId('result-page-marker')).toBeInTheDocument())
})

it('shows the degraded indicator when the socket is down', async () => {
  // re-mock subscribe to call onStatus(false); assert "live updates unavailable" renders
})
```

- [ ] **Step 2: Run to verify it fails** — page missing.

- [ ] **Step 3: Implement `useDiscoveryProgress.ts`:**

```ts
import { useEffect, useReducer, useRef, useState } from 'react'
import { subscribe } from '@/lib/eventbus'
import { useDiscoveryDetail, useDiscoveryResults } from './useDiscoveryDetail'
import { initialProgress, reduceProgress, seedFromResults, summarize, type ProgressState } from './progress'

/**
 * Live discovery progress: seeds from persisted results (reload-safe), then
 * overlays bridge events from nms.discovery.<id>. Polling of results stays on
 * while the run is active as the degraded-mode fallback (seed merges are
 * idempotent — terminal rows win).
 */
export function useDiscoveryProgress(id: number) {
  const [state, dispatch] = useReducer(reduceProgress, initialProgress)
  const [live, setLive] = useState(false)

  const detail = useDiscoveryDetail(id)
  const isActive = state.runState === 'RUNNING' || detail.data?.status === 'RUNNING'
  const results = useDiscoveryResults(id, isActive)

  // Seed / fallback-merge whenever persisted data changes.
  const seedRef = useRef<(r: Parameters<typeof seedFromResults>[1], s: string) => void>(() => {})
  seedRef.current = (r, s) => dispatch({ __seed: { results: r, status: s } } as never)

  useEffect(() => {
    if (results.data && detail.data) seedRef.current(results.data, detail.data.status)
  }, [results.data, detail.data])

  useEffect(() => {
    if (!Number.isFinite(id)) return
    return subscribe(`nms.discovery.${id}`, (body) => dispatch(body as never), setLive)
  }, [id])

  return { state, summary: summarize(state), live }
}
```

The `__seed` action needs reducer support — add to `reduceProgress` in `progress.ts` (top of function, before the object guard's return):

```ts
  const seed = (event as { __seed?: { results: DiscoveryResult[]; status: string } } | null)?.__seed
  if (seed) return seedFromResults(state, seed.results, seed.status)
```

- [ ] **Step 4: Implement `DiscoveryProgressPage.tsx`:**

```tsx
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/states'
import { useDiscoveryProgress } from './useDiscoveryProgress'
import type { ProgressRow } from './progress'

function StageChip({ row }: { row: ProgressRow }) {
  if (!row.stage) return <span className="text-sm text-muted-foreground">queued</span>
  const variant = row.status === 'failed' ? 'destructive' : row.status === 'completed' ? 'default' : 'secondary'
  return <Badge variant={variant}>{row.stage}</Badge>
}

function RowBar({ value, failed }: { value: number; failed: boolean }) {
  return (
    <div className="h-2 w-28 rounded bg-muted">
      <div
        className={`h-2 rounded ${failed ? 'bg-red-500' : 'bg-primary'}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

export function DiscoveryProgressPage() {
  const { id } = useParams<{ id: string }>()
  const discoveryId = Number(id)
  const navigate = useNavigate()
  const { state, summary, live } = useDiscoveryProgress(discoveryId)

  useEffect(() => {
    if (state.runState === 'COMPLETED') navigate(`/discovery/${discoveryId}/result`, { replace: true })
  }, [state.runState, discoveryId, navigate])

  const rows = Object.values(state.rows)

  const columns: Column<ProgressRow>[] = [
    { header: 'IP', cell: (r) => r.ip },
    { header: 'Stage', cell: (r) => <StageChip row={r} /> },
    { header: 'Progress', cell: (r) => <RowBar value={r.progress} failed={r.status === 'failed'} /> },
    { header: '%', cell: (r) => `${Math.round(r.progress)}%` },
    { header: 'Message', cell: (r) => r.message ?? '' },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discovery progress</h1>
        {live
          ? <Badge variant="secondary">Live</Badge>
          : <Badge variant="outline">live updates unavailable — falling back to polling</Badge>}
      </div>

      {state.runState === 'FAILED' && (
        <p className="mb-4 text-sm text-red-600">Run failed{state.runMessage ? `: ${state.runMessage}` : ''}</p>
      )}

      <div className="mb-2 h-3 w-full rounded bg-muted">
        <div className="h-3 rounded bg-primary transition-all" style={{ width: `${summary.overallPct}%` }} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{summary.overallPct}%</p>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="tile-total">{summary.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Discovered</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-green-600" data-testid="tile-discovered">{summary.discovered}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600" data-testid="tile-failed">{summary.failed}</CardContent></Card>
      </div>

      {rows.length === 0
        ? <EmptyState message="Waiting for targets…" />
        : <DataTable columns={columns} rows={rows} rowKey={(r) => r.ip} />}
    </div>
  )
}
```

- [ ] **Step 5: Route in `App.tsx`** (lazy import + route, same pattern as Task 4):

```tsx
          <Route path="/discovery/:id/progress" element={<DiscoveryProgressPage />} />
```

- [ ] **Step 6: Verify + commit**

```bash
npx vitest run src/features/discovery && npm run lint && npm test
git add src/features/discovery/useDiscoveryProgress.ts src/features/discovery/DiscoveryProgressPage.tsx src/features/discovery/progress.ts src/features/discovery/DiscoveryProgressPage.test.tsx src/App.tsx
git commit -m "feat(discovery): live progress page fed by SockJS events with polling fallback"
```

---

### Task 7: Result page + slimmer detail page

**Files:**
- Create: `src/features/discovery/DiscoveryResultPage.tsx`
- Modify: `src/features/discovery/DiscoveryDetailPage.tsx`, `src/App.tsx`
- Test: Create `src/features/discovery/DiscoveryResultPage.test.tsx` (move the provision-flow test out of any old detail-page test)

**Interfaces:**
- Produces: `/discovery/:id/result` owns the result table + checkbox → Provision-selected flow (exact behavior the old detail page had). `/discovery/:id` becomes profile summary + Edit/Delete/Run; Run navigates to `/discovery/:id/progress`.

- [ ] **Step 1: Create `DiscoveryResultPage.tsx`** — move the results-table half of the current `DiscoveryDetailPage.tsx` (columns, `selectedIps`, `toggleIp`, `handleProvision`, `useDiscoveryResults`, `useProvision`) into the new page verbatim, with a header showing the profile name and a "Back to profile" link. Results polling: `useDiscoveryResults(discoveryId, detail.data?.status === 'RUNNING')` unchanged. Keep `rowKey={(r) => r.id}`.

- [ ] **Step 2: Slim `DiscoveryDetailPage.tsx`** — remove the results table and provisioning pieces; keep the header (name, ip:port, status badge, plugin_type badge). Buttons:

```tsx
                <Button variant="outline" onClick={() => navigate(`/discovery/${discoveryId}/edit`)}>Edit</Button>
                <Button variant="outline" onClick={() => navigate(`/discovery/${discoveryId}/result`)}>Results</Button>
                <Button
                  disabled={isRunning}
                  onClick={() => run.mutate(discoveryId, {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: ['discovery', discoveryId] })
                      navigate(`/discovery/${discoveryId}/progress`)
                    },
                    onError: (e) => toast.error((e as Error).message),
                  })}
                >
                  Run
                </Button>
```

- [ ] **Step 3: Write/adjust tests.** `DiscoveryResultPage.test.tsx`: render at `/discovery/3/result` with MSW results (one COMPLETED, one FAILED); assert only COMPLETED rows get a checkbox; select and click "Provision selected"; assert `POST /api/provision/3` body `{selected_ips:['<ip>']}` and navigation to `/provisioning`. Detail-page test: Run click navigates to `/discovery/3/progress`.

- [ ] **Step 4: Route in `App.tsx`:**

```tsx
          <Route path="/discovery/:id/result" element={<DiscoveryResultPage />} />
```

- [ ] **Step 5: Verify + commit**

```bash
npx vitest run src/features/discovery && npm run lint && npm test
git add -A src/features/discovery src/App.tsx
git commit -m "feat(discovery): dedicated result page; detail page runs into live progress"
```

---

### Task 8: Polled-data grid on the device drilldown

**Files:**
- Create: `src/features/provisioning/PolledDataGrid.tsx`
- Modify: `src/features/provisioning/ProvisioningDetailPage.tsx`
- Test: Create `src/features/provisioning/PolledDataGrid.test.tsx`

**Interfaces:**
- Consumes: `usePolledData(jobId)` (existing, 10s refetch), `PolledData` rows (newest-first from the backend).
- Produces: a paginated raw-data table (Timestamp, Metric, Values) rendered between `MetricCharts` and `AvailabilityPanel`.

- [ ] **Step 1: Write the failing test** — `PolledDataGrid.test.tsx`:

```tsx
// Providers + MSW: GET /api/polled-data/5 returns 60 rows (newest-first), metric_type CPU,
// data { system_cpu_percent: 12.5 }, polled_at ISO strings.
it('renders newest-first rows with formatted values and pages by 25', async () => {
  renderGrid(5)
  const rows = await screen.findAllByRole('row')
  expect(rows.length).toBe(26)   // header + first page of 25
  expect(screen.getByText('CPU')).toBeInTheDocument()
  expect(screen.getAllByText(/system_cpu_percent: 12.5/)[0]).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(screen.getByText(/page 2/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails** — component missing.

- [ ] **Step 3: Implement `PolledDataGrid.tsx`:**

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import type { PolledData } from '@/lib/types'
import { usePolledData } from './useJobDetail'

const PAGE_SIZE = 25

function formatValues(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
    .join(', ')
}

/** Raw polled samples, newest first (backend order), paginated client-side. */
export function PolledDataGrid({ jobId }: { jobId: number }) {
  const polled = usePolledData(jobId)
  const [page, setPage] = useState(0)

  if (polled.isLoading) return <Loading />
  if (polled.isError) return <ErrorState message={(polled.error as Error).message} onRetry={() => polled.refetch()} />
  if (!polled.data || polled.data.length === 0) return <EmptyState message="No polled data yet." />

  const pageCount = Math.ceil(polled.data.length / PAGE_SIZE)
  const rows = polled.data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const columns: Column<PolledData>[] = [
    { header: 'Timestamp', cell: (r) => new Date(r.polled_at).toLocaleString() },
    { header: 'Metric', cell: (r) => r.metric_type },
    { header: 'Values', cell: (r) => <span className="font-mono text-xs">{formatValues(r.data)}</span> },
  ]

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Raw polled data</h2>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      {pageCount > 1 && (
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Mount it in `ProvisioningDetailPage.tsx`** between the charts and availability blocks:

```tsx
            <div className="mt-6">
              <PolledDataGrid jobId={jobId} />
            </div>
```

- [ ] **Step 5: Verify + commit**

```bash
npx vitest run src/features/provisioning && npm run lint && npm test
git add src/features/provisioning/
git commit -m "feat(provisioning): raw polled-data grid on the device drilldown"
```

---

### Task 9: Slim dashboard (no averaging)

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`, `src/features/dashboard/useDashboard.ts`
- Test: Modify `src/features/dashboard/DashboardPage.test.tsx` (or create if absent)

**Interfaces:**
- Produces: dashboard shows three count cards (Total devices, Devices Up, Devices Down) + quick links to `/discovery` and `/provisioning`. No `avgUptimePct`, no per-device uptime table.

- [ ] **Step 1: Write/adjust the failing test:**

```tsx
it('shows counts and quick links, and no avg-uptime KPI', async () => {
  // MSW: two jobs; availability job1 {is_up:true,...}, job2 {is_up:false,...}
  renderDashboard()
  expect(await screen.findByTestId('devices-up')).toHaveTextContent('1')
  expect(screen.getByTestId('devices-down')).toHaveTextContent('1')
  expect(screen.getByTestId('total-devices')).toHaveTextContent('2')
  expect(screen.queryByTestId('avg-uptime')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /discovery/i })).toHaveAttribute('href', '/discovery')
  expect(screen.getByRole('link', { name: /devices/i })).toHaveAttribute('href', '/provisioning')
})
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement.** In `useDashboard.ts`: delete `avgUptimePct` from the computation and the return object (keep `devicesUp`/`devicesDown`/`totalJobs` and the availability `useQueries` that powers them). In `DashboardPage.tsx`: delete the Avg Uptime `Card`, the `JobRow` interface, `columns`, the `DataTable` + loading/empty block, and the `formatPct` import; rename card testids to `total-devices` / `devices-up` / `devices-down`; add quick links below the cards:

```tsx
      <div className="flex gap-3">
        <Link to="/discovery" className="text-sm underline underline-offset-4">Go to Discovery</Link>
        <Link to="/provisioning" className="text-sm underline underline-offset-4">Go to Devices</Link>
      </div>
```

(`import { Link } from 'react-router-dom'`.)

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run src/features/dashboard && npm run lint && npm test
git add src/features/dashboard/
git commit -m "feat(dashboard): slim count-only dashboard, drop availability averaging"
```

---

## Final verification (whole plan)

- [ ] `npm run lint && npm test` — everything green.
- [ ] Live E2E against the backend (backend plan must be merged & running on :8080 with the Go plugin binary): login → create SNMP + LINUX credentials → create a CIDR LINUX discovery → Run → watch the progress page advance PING → PORT → PLUGIN live → auto-land on results → provision an IP → device drilldown shows charts + raw grid → dashboard shows counts only.
