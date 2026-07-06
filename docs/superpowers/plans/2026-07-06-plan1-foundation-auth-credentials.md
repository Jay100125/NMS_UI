# NMSLITE_UI Plan 1 — Foundation, Auth & Credentials

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the React/TypeScript UI foundation and ship the first working vertical slice — JWT login/register, an authenticated app shell, and full Credentials CRUD — all test-covered against a mocked API.

**Architecture:** Vite SPA. A single Axios instance unwraps the backend's `{status.code,status,message/error,result[]}` envelope so feature code sees plain data. Server data lives in TanStack Query (per-domain typed hooks); auth token lives in a Zustand store persisted to `localStorage`. React Router v6 gates the app shell behind `<ProtectedRoute>`. This slice establishes the api-module → query-hook → screen pattern every later screen reuses.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router v6, TanStack Query v5, Zustand, Axios, React Hook Form, Zod, Vitest, React Testing Library, MSW.

## Global Constraints

- Dev server runs on **port 3000** (backend CORS allows only `http://localhost:3000`).
- Backend base URL from `VITE_API_BASE` (default `http://localhost:8080`); dev uses a Vite proxy so the browser origin is `http://localhost:3000`.
- Response envelope is contractual: success `{ "status.code":int, "status":"success", "message":str, "result":array }`; error `{ "status.code":int, "status":"failure", "error":str }`. `result` is **always an array**. Login token = `result[0]` (raw JWT string).
- Auth: `POST /api/login` and `POST /api/register` are public; every other `/api/*` call sends `Authorization: Bearer <jwt>`. On `401` the client clears auth and redirects to `/login`.
- Vocabulary: credential `system_type` ∈ `LINUX|SNMP|WINRM`.
- Node 20+. Package manager: `npm`.
- TDD: write the failing test first. Commit after each green task.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- IP boundary: the Motadata UI is inspiration only — never copy its code/config/assets.

---

## File Structure

```
NMSLITE_UI/
  index.html
  vite.config.ts                 # port 3000, /api + /health proxy, @ alias, vitest config
  tsconfig.json  tsconfig.node.json
  tailwind.config.ts  postcss.config.js
  components.json                # shadcn config
  package.json
  .env.example                   # VITE_API_BASE
  .github/workflows/ci.yml
  src/
    main.tsx                     # app entry: providers + router
    App.tsx                      # route tree
    index.css                    # tailwind directives + shadcn tokens
    vite-env.d.ts
    test/setup.ts                # RTL + MSW test bootstrap
    test/server.ts               # MSW server + default handlers
    lib/
      env.ts                     # typed VITE_API_BASE accessor
      queryClient.ts             # configured QueryClient
      types.ts                   # shared domain types
    api/
      client.ts                  # axios instance + envelope unwrap + interceptors
      auth.ts                    # login/register endpoint functions
      credentials.ts             # credential endpoint functions
    stores/
      auth.ts                    # zustand auth store (token, user, persistence)
    routes/
      ProtectedRoute.tsx
    components/
      AppLayout.tsx              # sidebar + topbar + <Outlet/>
      ui/                        # shadcn primitives (button, input, table, dialog, ...)
      DataTable.tsx              # generic TanStack table wrapper
      states.tsx                 # <Loading/> <ErrorState/> <EmptyState/>
    features/
      auth/
        LoginPage.tsx  RegisterPage.tsx
        useAuth.ts               # useLogin, useRegister hooks
      credentials/
        CredentialsPage.tsx      # list + table
        CredentialDrawer.tsx     # create/edit form
        useCredentials.ts        # query + mutation hooks
```

---

## Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `.env.example`, `.gitignore`, `src/test/setup.ts`

**Interfaces:**
- Produces: a booting Vite app on port 3000 with Vitest wired. Later tasks add providers to `src/main.tsx` and routes to `src/App.tsx`.

- [ ] **Step 1: Create the project with Vite**

Run from `~/personal/NMSLITE_UI`:
```bash
npm create vite@latest . -- --template react-ts
npm install
```
(Answer "ignore existing files / continue" if prompted — the `docs/` dir already exists.)

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install react-router-dom @tanstack/react-query zustand axios react-hook-form zod @hookform/resolvers
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @types/node
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Write `vite.config.ts`** (port 3000, proxy, alias, vitest)

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/health': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

- [ ] **Step 4: Configure Tailwind**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```
Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Add path alias to `tsconfig.json`**

Under `compilerOptions` add:
```jsonc
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 6: Add scripts + test setup**

In `package.json` `"scripts"` ensure:
```jsonc
"dev": "vite",
"build": "tsc -b && vite build",
"test": "vitest run",
"test:watch": "vitest",
"lint": "tsc --noEmit"
```
Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```
Create `.env.example`:
```
VITE_API_BASE=http://localhost:8080
```
Append to `.gitignore`: `node_modules`, `dist`, `.env`, `coverage`.

- [ ] **Step 7: Write a smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app root', () => {
  render(<App />)
  expect(screen.getByText(/lite-nms/i)).toBeInTheDocument()
})
```
Set `src/App.tsx` to a minimal placeholder so the test can pass:
```tsx
export default function App() {
  return <div>Lite-NMS</div>
}
```

- [ ] **Step 8: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test). Also verify `npm run build` succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS with Tailwind and Vitest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Initialize shadcn/ui + base primitives

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (button, input, label, table, dialog, sheet, select, sonner/toast, card, badge, skeleton)
- Modify: `src/index.css` (shadcn tokens), `tailwind.config.ts`

**Interfaces:**
- Produces: shadcn primitives importable as `@/components/ui/<name>`. Later tasks import `Button`, `Input`, `Table`, `Sheet`, `Select`, `Dialog`, `Badge`, `Skeleton`, and the toaster.

- [ ] **Step 1: Init shadcn**

```bash
npx shadcn@latest init -d
```
Accept defaults (New York style, Slate base, CSS variables). This writes `components.json`, `src/lib/utils.ts`, updates `src/index.css` with design tokens, and updates `tailwind.config.ts`.

- [ ] **Step 2: Add the primitives this slice needs**

```bash
npx shadcn@latest add button input label table dialog sheet select card badge skeleton sonner
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: no type errors. Run `npm test` — the smoke test still passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: init shadcn/ui and base primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Shared types + typed env

**Files:**
- Create: `src/lib/types.ts`, `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces:
  - `type SystemType = 'LINUX' | 'SNMP' | 'WINRM'`
  - `interface Credential { id: number; credential_name: string; system_type: SystemType; cred_data: string }`
  - `interface ApiEnvelope<T> { 'status.code': number; status: 'success' | 'failure'; message?: string; error?: string; result?: T }`
  - `apiBase(): string` — returns `VITE_API_BASE` or `''` (so dev proxy paths stay relative).

- [ ] **Step 1: Write the failing test**

`src/lib/env.test.ts`:
```ts
import { apiBase } from './env'

test('apiBase returns a string', () => {
  expect(typeof apiBase()).toBe('string')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/env.ts`:
```ts
/** Base URL for the API. Empty string in dev so the Vite proxy handles relative /api paths. */
export function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? ''
}
```
`src/lib/types.ts`:
```ts
export type SystemType = 'LINUX' | 'SNMP' | 'WINRM'

export interface Credential {
  id: number
  credential_name: string
  system_type: SystemType
  cred_data: string
}

export interface ApiEnvelope<T> {
  'status.code': number
  status: 'success' | 'failure'
  message?: string
  error?: string
  result?: T
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/env.ts src/lib/env.test.ts
git commit -m "feat: shared domain types and typed env accessor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Axios client with envelope unwrapping + interceptors

**Files:**
- Create: `src/api/client.ts`
- Test: `src/api/client.test.ts`

**Interfaces:**
- Consumes: `apiBase()` (Task 3), `useAuthStore` is NOT imported here to avoid a cycle — the token is read via a getter registered by the store (Task 5). Expose `setAuthTokenGetter(fn: () => string | null)` and `setOnUnauthorized(fn: () => void)`.
- Produces:
  - `api` — a configured `AxiosInstance`.
  - `unwrap<T>(promise: Promise<AxiosResponse>): Promise<T>` — resolves `response.data.result` on success; throws `Error(response.data.error)` when `status === 'failure'`.
  - `setAuthTokenGetter`, `setOnUnauthorized`.

- [ ] **Step 1: Write the failing test**

`src/api/client.test.ts`:
```ts
import { unwrap } from './client'

test('unwrap returns result on success', async () => {
  const res = { data: { 'status.code': 200, status: 'success', result: [{ id: 1 }] } }
  await expect(unwrap<any>(Promise.resolve(res as any))).resolves.toEqual([{ id: 1 }])
})

test('unwrap throws server error message on failure', async () => {
  const res = { data: { 'status.code': 409, status: 'failure', error: 'Credential name already exists' } }
  await expect(unwrap<any>(Promise.resolve(res as any))).rejects.toThrow('Credential name already exists')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/api/client.ts`:
```ts
import axios, { type AxiosResponse } from 'axios'
import { apiBase } from '@/lib/env'
import type { ApiEnvelope } from '@/lib/types'

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function setAuthTokenGetter(fn: () => string | null) { tokenGetter = fn }
export function setOnUnauthorized(fn: () => void) { onUnauthorized = fn }

export const api = axios.create({ baseURL: apiBase() })

api.interceptors.request.use((config) => {
  const token = tokenGetter()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) onUnauthorized()
    return Promise.reject(error)
  },
)

/** Unwraps the backend envelope: resolves result on success, throws error text on failure. */
export async function unwrap<T>(p: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  const res = await p
  const body = res.data
  if (body.status === 'failure') throw new Error(body.error ?? 'Request failed')
  return body.result as T
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/client.test.ts
git commit -m "feat: axios client with envelope unwrapping and auth interceptors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Auth store (Zustand) with persistence

**Files:**
- Create: `src/stores/auth.ts`
- Test: `src/stores/auth.test.ts`

**Interfaces:**
- Consumes: `setAuthTokenGetter`, `setOnUnauthorized` (Task 4).
- Produces: `useAuthStore` with state `{ token: string | null; username: string | null }` and actions `setSession(token, username)`, `logout()`. Persists `token`/`username` to `localStorage` key `nms.auth`. On module load it wires the token getter and 401 handler into the api client. Exposes selector helper `isAuthenticated(state)`.

- [ ] **Step 1: Write the failing test**

`src/stores/auth.test.ts`:
```ts
import { useAuthStore } from './auth'

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().logout()
})

test('setSession stores token and persists', () => {
  useAuthStore.getState().setSession('jwt-123', 'admin')
  expect(useAuthStore.getState().token).toBe('jwt-123')
  expect(JSON.parse(localStorage.getItem('nms.auth')!)).toMatchObject({ token: 'jwt-123', username: 'admin' })
})

test('logout clears token and storage', () => {
  useAuthStore.getState().setSession('jwt-123', 'admin')
  useAuthStore.getState().logout()
  expect(useAuthStore.getState().token).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/stores/auth.ts`:
```ts
import { create } from 'zustand'
import { setAuthTokenGetter, setOnUnauthorized } from '@/api/client'

const KEY = 'nms.auth'

interface Persisted { token: string | null; username: string | null }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { token: null, username: null }
  } catch {
    return { token: null, username: null }
  }
}

interface AuthState extends Persisted {
  setSession: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  ...load(),
  setSession: (token, username) => {
    localStorage.setItem(KEY, JSON.stringify({ token, username }))
    set({ token, username })
  },
  logout: () => {
    localStorage.removeItem(KEY)
    set({ token: null, username: null })
  },
}))

export const isAuthenticated = (s: Pick<AuthState, 'token'>) => Boolean(s.token)

// Wire the store into the api client (token read + 401 handling).
setAuthTokenGetter(() => useAuthStore.getState().token)
setOnUnauthorized(() => useAuthStore.getState().logout())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/auth.ts src/stores/auth.test.ts
git commit -m "feat: zustand auth store with localStorage persistence and client wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: MSW test server + query client + shared state components

**Files:**
- Create: `src/test/server.ts`, `src/lib/queryClient.ts`, `src/components/states.tsx`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Produces:
  - `server` — MSW `setupServer` with overridable handlers, started/stopped in `setup.ts`.
  - `queryClient` factory `makeQueryClient()` (retry off in tests via param).
  - `<Loading/>`, `<ErrorState message onRetry/>`, `<EmptyState message/>` components.

- [ ] **Step 1: Write the MSW server + default handlers**

`src/test/server.ts`:
```ts
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const ok = (result: unknown) => HttpResponse.json({ 'status.code': 200, status: 'success', result })

export const server = setupServer(
  http.post('*/api/login', () => ok(['jwt-test-token'])),
  http.post('*/api/register', () => HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 1 }] })),
  http.get('*/api/credential', () => ok([])),
)
```

- [ ] **Step 2: Start the server in test setup**

Append to `src/test/setup.ts`:
```ts
import { server } from './server'
import { beforeAll, afterEach, afterAll } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 3: Implement the query client factory + state components**

`src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(retry = true) {
  return new QueryClient({ defaultOptions: { queries: { retry: retry ? 1 : false } } })
}
```
`src/components/states.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function Loading() {
  return <div className="space-y-2 p-4" data-testid="loading"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 text-sm text-red-600" role="alert">
      <p>{message}</p>
      {onRetry && <Button variant="outline" className="mt-2" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-muted-foreground">{message}</div>
}
```

- [ ] **Step 4: Verify tests still pass**

Run: `npm test`
Expected: all prior tests PASS; no unhandled-request errors.

- [ ] **Step 5: Commit**

```bash
git add src/test/server.ts src/test/setup.ts src/lib/queryClient.ts src/components/states.tsx
git commit -m "test: MSW server, query client factory, shared state components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Auth API module + login/register hooks

**Files:**
- Create: `src/api/auth.ts`, `src/features/auth/useAuth.ts`
- Test: `src/features/auth/useAuth.test.tsx`

**Interfaces:**
- Consumes: `api`, `unwrap` (Task 4); `useAuthStore` (Task 5).
- Produces:
  - `login(username, password): Promise<string>` — returns the JWT (`result[0]`).
  - `register(username, password): Promise<void>`.
  - `useLogin()` / `useRegister()` — React Query mutations; `useLogin` calls `setSession(token, username)` on success.

- [ ] **Step 1: Write the failing test**

`src/features/auth/useAuth.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/queryClient'
import { useLogin } from './useAuth'
import { useAuthStore } from '@/stores/auth'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={makeQueryClient(false)}>{children}</QueryClientProvider>
)

test('useLogin stores the returned token', async () => {
  useAuthStore.getState().logout()
  const { result } = renderHook(() => useLogin(), { wrapper })
  result.current.mutate({ username: 'admin', password: 'password1' })
  await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-test-token'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/useAuth.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/api/auth.ts`:
```ts
import { api, unwrap } from './client'

export async function login(username: string, password: string): Promise<string> {
  const result = await unwrap<string[]>(api.post('/api/login', { username, password }))
  return result[0]
}

export async function register(username: string, password: string): Promise<void> {
  await unwrap<unknown[]>(api.post('/api/register', { username, password }))
}
```
`src/features/auth/useAuth.ts`:
```ts
import { useMutation } from '@tanstack/react-query'
import { login, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => login(v.username, v.password),
    onSuccess: (token, v) => setSession(token, v.username),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => register(v.username, v.password),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/useAuth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/auth.ts src/features/auth/useAuth.ts src/features/auth/useAuth.test.tsx
git commit -m "feat(auth): auth api module and login/register mutation hooks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Router, ProtectedRoute, providers wired into the app

**Files:**
- Create: `src/routes/ProtectedRoute.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`
- Test: `src/routes/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `isAuthenticated` (Task 5).
- Produces: `<ProtectedRoute>` renders `<Outlet/>` when authenticated, else `<Navigate to="/login"/>`. `App` mounts routes: public `/login`, `/register`; protected shell with index Dashboard placeholder and `/credentials`. `main.tsx` wraps `<App/>` in `QueryClientProvider` + `BrowserRouter` + `<Toaster/>`.

- [ ] **Step 1: Write the failing test**

`src/routes/ProtectedRoute.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/stores/auth'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>secret</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('redirects to login when unauthenticated', () => {
  useAuthStore.getState().logout()
  renderAt('/secret')
  expect(screen.getByText('login page')).toBeInTheDocument()
})

test('renders child when authenticated', () => {
  useAuthStore.getState().setSession('jwt', 'admin')
  renderAt('/secret')
  expect(screen.getByText('secret')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/ProtectedRoute.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ProtectedRoute**

`src/routes/ProtectedRoute.tsx`:
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, isAuthenticated } from '@/stores/auth'

export function ProtectedRoute() {
  const authed = useAuthStore(isAuthenticated)
  return authed ? <Outlet /> : <Navigate to="/login" replace />
}
```

- [ ] **Step 4: Wire App + main**

`src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { CredentialsPage } from '@/features/credentials/CredentialsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<div className="p-6">Lite-NMS Dashboard (Plan 2)</div>} />
          <Route path="/credentials" element={<CredentialsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```
`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { makeQueryClient } from '@/lib/queryClient'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={makeQueryClient()}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
```
> Note: `App.tsx` now imports `AppLayout`, `LoginPage`, `RegisterPage`, `CredentialsPage` (Tasks 9–11). Delete `src/App.test.tsx` from Task 1 (the `<App/>` smoke test now requires a router context and is superseded by the ProtectedRoute + page tests). If you implement tasks in order, create empty stub components first or implement 9–11 before running the app.

- [ ] **Step 5: Run the ProtectedRoute test**

Run: `npx vitest run src/routes/ProtectedRoute.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/ProtectedRoute.tsx src/routes/ProtectedRoute.test.tsx src/main.tsx src/App.tsx
git rm -f src/App.test.tsx
git commit -m "feat: router, ProtectedRoute guard, and app providers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: App shell + Login/Register pages

**Files:**
- Create: `src/components/AppLayout.tsx`, `src/features/auth/LoginPage.tsx`, `src/features/auth/RegisterPage.tsx`
- Test: `src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useLogin`/`useRegister` (Task 7), `useAuthStore` (Task 5), shadcn primitives.
- Produces: `AppLayout` (sidebar links to Dashboard `/`, Credentials `/credentials`; topbar with username, logout button, dark-mode toggle) rendering `<Outlet/>`. `LoginPage`/`RegisterPage` with RHF+Zod forms; on success login navigates to `/`, register navigates to `/login`.

- [ ] **Step 1: Write the failing test**

`src/features/auth/LoginPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/queryClient'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '@/stores/auth'

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('logs in and stores session', async () => {
  useAuthStore.getState().logout()
  renderPage()
  await userEvent.type(screen.getByLabelText(/username/i), 'admin')
  await userEvent.type(screen.getByLabelText(/password/i), 'password1')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-test-token'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/LoginPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AppLayout**

`src/components/AppLayout.tsx`:
```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/credentials', label: 'Credentials' },
]

export function AppLayout() {
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()
  const toggleDark = () => document.documentElement.classList.toggle('dark')
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 space-y-1">
        <div className="mb-4 font-semibold">Lite-NMS</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
            className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? 'bg-muted font-medium' : 'hover:bg-muted'}`}>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-4 py-2">
          <span className="text-sm text-muted-foreground">{username}</span>
          <Button variant="ghost" size="sm" onClick={toggleDark}>Theme</Button>
          <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/login') }}>Logout</Button>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement LoginPage + RegisterPage**

`src/features/auth/LoginPage.tsx`:
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useLogin } from './useAuth'

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) })
type Form = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = (v: Form) =>
    mutate(v, { onSuccess: () => navigate('/'), onError: (e) => toast.error((e as Error).message) })

  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-80 p-6">
        <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><Label htmlFor="username">Username</Label><Input id="username" {...register('username')} />
            {errors.username && <p className="text-xs text-red-600">Required</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">Required</p>}</div>
          <Button type="submit" className="w-full" disabled={isPending}>Sign in</Button>
        </form>
        <p className="mt-3 text-center text-sm">No account? <Link className="underline" to="/register">Register</Link></p>
      </Card>
    </div>
  )
}
```
`src/features/auth/RegisterPage.tsx`:
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useRegister } from './useAuth'

const schema = z.object({ username: z.string().min(1), password: z.string().min(8, 'Min 8 characters') })
type Form = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = (v: Form) =>
    mutate(v, {
      onSuccess: () => { toast.success('Account created — sign in'); navigate('/login') },
      onError: (e) => toast.error((e as Error).message),
    })

  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-80 p-6">
        <h1 className="mb-4 text-lg font-semibold">Create account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><Label htmlFor="username">Username</Label><Input id="username" {...register('username')} />
            {errors.username && <p className="text-xs text-red-600">Required</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <Button type="submit" className="w-full" disabled={isPending}>Create account</Button>
        </form>
        <p className="mt-3 text-center text-sm">Have an account? <Link className="underline" to="/login">Sign in</Link></p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Run the login test**

Run: `npx vitest run src/features/auth/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppLayout.tsx src/features/auth/LoginPage.tsx src/features/auth/RegisterPage.tsx src/features/auth/LoginPage.test.tsx
git commit -m "feat(auth): app shell, login and register pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Credentials API module + list screen

**Files:**
- Create: `src/api/credentials.ts`, `src/features/credentials/useCredentials.ts`, `src/features/credentials/CredentialsPage.tsx`, `src/components/DataTable.tsx`
- Test: `src/features/credentials/CredentialsPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `unwrap` (Task 4); `Credential`, `SystemType` (Task 3); state components (Task 6).
- Produces:
  - `listCredentials(): Promise<Credential[]>`, `createCredential(input)`, `updateCredential(id, input)`, `deleteCredential(id)`.
  - `input` type `CredentialInput = { credential_name: string; protocol: SystemType; cred_data: { user: string; password: string } }`.
  - `useCredentials()` query (key `['credentials']`); `useCreateCredential()`, `useUpdateCredential()`, `useDeleteCredential()` mutations that invalidate `['credentials']`.
  - `CredentialsPage` renders a table of credentials with a "New credential" button (drawer wired in Task 11).

- [ ] **Step 1: Write the failing test**

`src/features/credentials/CredentialsPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialsPage } from './CredentialsPage'

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <MemoryRouter><CredentialsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('lists credentials from the api', async () => {
  server.use(http.get('*/api/credential', () =>
    HttpResponse.json({ 'status.code': 200, status: 'success', result: [
      { id: 1, credential_name: 'linux-root', system_type: 'LINUX', cred_data: 'enc' },
    ] })))
  renderPage()
  await waitFor(() => expect(screen.getByText('linux-root')).toBeInTheDocument())
  expect(screen.getByText('LINUX')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/credentials/CredentialsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the api module + hooks**

`src/api/credentials.ts`:
```ts
import { api, unwrap } from './client'
import type { Credential, SystemType } from '@/lib/types'

export interface CredentialInput {
  credential_name: string
  protocol: SystemType
  cred_data: { user: string; password: string }
}

export const listCredentials = () => unwrap<Credential[]>(api.get('/api/credential'))
export const createCredential = (input: CredentialInput) => unwrap<unknown[]>(api.post('/api/credential', input))
export const updateCredential = (id: number, input: Partial<CredentialInput>) =>
  unwrap<unknown[]>(api.patch(`/api/credential/${id}`, input))
export const deleteCredential = (id: number) => unwrap<unknown[]>(api.delete(`/api/credential/${id}`))
```
`src/features/credentials/useCredentials.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCredentials, createCredential, updateCredential, deleteCredential, type CredentialInput } from '@/api/credentials'

const KEY = ['credentials'] as const

export function useCredentials() {
  return useQuery({ queryKey: KEY, queryFn: listCredentials })
}

export function useCreateCredential() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (i: CredentialInput) => createCredential(i), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}

export function useUpdateCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; input: Partial<CredentialInput> }) => updateCredential(v.id, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCredential() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: number) => deleteCredential(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) })
}
```

- [ ] **Step 4: Implement DataTable + CredentialsPage**

`src/components/DataTable.tsx`:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface Column<T> { header: string; cell: (row: T) => React.ReactNode }

export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{columns.map((c) => <TableHead key={c.header}>{c.header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)}>{columns.map((c) => <TableCell key={c.header}>{c.cell(row)}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```
`src/features/credentials/CredentialsPage.tsx`:
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { Loading, ErrorState, EmptyState } from '@/components/states'
import { useCredentials } from './useCredentials'
import { CredentialDrawer } from './CredentialDrawer'
import type { Credential } from '@/lib/types'

export function CredentialsPage() {
  const { data, isLoading, isError, error, refetch } = useCredentials()
  const [editing, setEditing] = useState<Credential | null>(null)
  const [open, setOpen] = useState(false)

  const columns: Column<Credential>[] = [
    { header: 'Name', cell: (r) => r.credential_name },
    { header: 'Type', cell: (r) => <Badge variant="secondary">{r.system_type}</Badge> },
    { header: '', cell: (r) => <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true) }}>Edit</Button> },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Credentials</h1>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>New credential</Button>
      </div>
      {isLoading ? <Loading />
        : isError ? <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.length === 0 ? <EmptyState message="No credentials yet." />
        : <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />}
      <CredentialDrawer open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
```
> `CredentialDrawer` is created in Task 11. To keep this task runnable in isolation, create a temporary stub `src/features/credentials/CredentialDrawer.tsx` exporting `export function CredentialDrawer(_: any) { return null }`; Task 11 replaces it.

- [ ] **Step 5: Run the list test**

Run: `npx vitest run src/features/credentials/CredentialsPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/credentials.ts src/features/credentials/useCredentials.ts src/features/credentials/CredentialsPage.tsx src/components/DataTable.tsx src/features/credentials/CredentialsPage.test.tsx src/features/credentials/CredentialDrawer.tsx
git commit -m "feat(credentials): api module, query hooks, and list screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Credential create/edit drawer + delete

**Files:**
- Create/replace: `src/features/credentials/CredentialDrawer.tsx`
- Modify: `src/features/credentials/CredentialsPage.tsx` (delete action)
- Test: `src/features/credentials/CredentialDrawer.test.tsx`

**Interfaces:**
- Consumes: `useCreateCredential`, `useUpdateCredential`, `useDeleteCredential` (Task 10); shadcn `Sheet`, `Select`, `Dialog`.
- Produces: `<CredentialDrawer open onOpenChange editing>` — RHF+Zod form (`credential_name`, `system_type` select, `user`, `password`). Create posts `{ credential_name, protocol, cred_data:{user,password} }`; edit patches. Password field is write-only (never prefilled from `editing`). On success closes the drawer and toasts.

- [ ] **Step 1: Write the failing test**

`src/features/credentials/CredentialDrawer.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { makeQueryClient } from '@/lib/queryClient'
import { CredentialDrawer } from './CredentialDrawer'

test('creates a credential with encrypted-at-rest payload shape', async () => {
  let received: any = null
  server.use(http.post('*/api/credential', async ({ request }) => {
    received = await request.json()
    return HttpResponse.json({ 'status.code': 201, status: 'success', result: [{ id: 9 }] })
  }))
  render(
    <QueryClientProvider client={makeQueryClient(false)}>
      <CredentialDrawer open onOpenChange={() => {}} editing={null} />
    </QueryClientProvider>,
  )
  await userEvent.type(screen.getByLabelText(/name/i), 'linux-root')
  await userEvent.type(screen.getByLabelText(/^user$/i), 'root')
  await userEvent.type(screen.getByLabelText(/password/i), 'hunter2!')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(received).toMatchObject({
    credential_name: 'linux-root',
    protocol: 'LINUX',
    cred_data: { user: 'root', password: 'hunter2!' },
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/credentials/CredentialDrawer.test.tsx`
Expected: FAIL — stub returns null / no form.

- [ ] **Step 3: Implement the drawer**

`src/features/credentials/CredentialDrawer.tsx`:
```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCredential, useUpdateCredential } from './useCredentials'
import type { Credential, SystemType } from '@/lib/types'

const TYPES: SystemType[] = ['LINUX', 'SNMP', 'WINRM']
const schema = z.object({
  credential_name: z.string().min(1, 'Required'),
  system_type: z.enum(['LINUX', 'SNMP', 'WINRM']),
  user: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})
type Form = z.infer<typeof schema>

export function CredentialDrawer({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Credential | null
}) {
  const create = useCreateCredential()
  const update = useUpdateCredential()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<Form>({ resolver: zodResolver(schema), defaultValues: { system_type: 'LINUX' } })

  // Prefill name/type on edit; never prefill the password (write-only).
  useEffect(() => {
    reset({
      credential_name: editing?.credential_name ?? '',
      system_type: (editing?.system_type as SystemType) ?? 'LINUX',
      user: '',
      password: '',
    })
  }, [editing, open, reset])

  const onSubmit = (v: Form) => {
    const payload = { credential_name: v.credential_name, protocol: v.system_type, cred_data: { user: v.user, password: v.password } }
    const done = { onSuccess: () => { toast.success('Saved'); onOpenChange(false) }, onError: (e: unknown) => toast.error((e as Error).message) }
    if (editing) update.mutate({ id: editing.id, input: payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>{editing ? 'Edit credential' : 'New credential'}</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div><Label htmlFor="credential_name">Name</Label><Input id="credential_name" {...register('credential_name')} />
            {errors.credential_name && <p className="text-xs text-red-600">{errors.credential_name.message}</p>}</div>
          <div>
            <Label>Type</Label>
            <Select value={watch('system_type')} onValueChange={(v) => setValue('system_type', v as SystemType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="user">User</Label><Input id="user" {...register('user')} />
            {errors.user && <p className="text-xs text-red-600">{errors.user.message}</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Save</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Add delete-with-confirm to CredentialsPage**

Replace the `''` column cell in `CredentialsPage.tsx` with an actions cell that also deletes. Add near the top of the component:
```tsx
import { useDeleteCredential } from './useCredentials'
// ...
const del = useDeleteCredential()
```
Change the actions column to:
```tsx
{ header: '', cell: (r) => (
  <div className="flex gap-2">
    <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true) }}>Edit</Button>
    <Button variant="ghost" size="sm" className="text-red-600"
      onClick={() => { if (confirm(`Delete ${r.credential_name}?`)) del.mutate(r.id) }}>Delete</Button>
  </div>
) },
```

- [ ] **Step 5: Run the drawer test + full suite**

Run: `npx vitest run src/features/credentials/CredentialDrawer.test.tsx` — Expected: PASS.
Run: `npm test` — Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/credentials/CredentialDrawer.tsx src/features/credentials/CredentialsPage.tsx src/features/credentials/CredentialDrawer.test.tsx
git commit -m "feat(credentials): create/edit drawer and delete with confirm

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: CI workflow + README + manual verification

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Produces: a green `npm run lint && npm test && npm run build` in CI, and a README documenting setup and the backend contract.

- [ ] **Step 1: Run the full local gate**

Run: `npm run lint && npm test && npm run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 2: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
jobs:
  ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Write README**

`README.md` covering: what it is (UI for Lite-NMS), stack, prerequisites (Node 20+), `npm install`, `npm run dev` (port 3000), the `VITE_API_BASE` env var + dev proxy to `:8080`, how to run the backend, `npm test`, `npm run build`, and the response-envelope contract. Note the Highcharts license caveat and that charts arrive in Plan 2.

- [ ] **Step 4: Manual verification against the real backend**

Start the Java backend (`NMS_JWT_SECRET=... NMS_CRED_KEY=... java -jar ...` on `:8080`), then `npm run dev`. In the browser: register a user, log in (token persists across reload), create a credential (verify it appears; the stored `cred_data` is ciphertext server-side), edit it, delete it, and confirm logout returns you to `/login`. Fix any envelope-shape mismatches surfaced here (this is where the spec's deferred field-name confirmation happens).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: GitHub Actions gate and README

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

- **Spec coverage (this slice):** stack foundation (Tasks 1–2) · typed env + types (Task 3) · envelope-unwrapping Axios client + interceptors (Task 4) · auth store + persistence (Task 5) · MSW/query-client/state components (Task 6) · auth API + hooks (Task 7) · router + ProtectedRoute guard (Task 8) · app shell + login/register (Task 9) · Credentials list (Task 10) · Credentials create/edit/delete with write-only password (Task 11) · CI + README + live verification (Task 12). Spec §3 stack, §4 contract, §5 architecture, §6 (auth + credentials screens), §7 cross-cutting (loading/error/empty, 401 handling, write-only secrets), §8 testing (guard, CRUD flow, envelope unwrap), §9 build/CI are all covered. **Deferred to Plan 2:** Dashboard, Discovery, Provisioning screens and Highcharts (spec §6 items 2, 4–7).
- **Placeholder scan:** every code step contains complete code. The two intentional temporary stubs (`CredentialDrawer` in Task 10, superseded `App.test.tsx`) are called out explicitly with their replacement/removal task.
- **Type consistency:** `ApiEnvelope<T>`, `Credential`, `SystemType`, `CredentialInput`, `unwrap`, `setAuthTokenGetter`/`setOnUnauthorized`, `useAuthStore.setSession/logout`, `makeQueryClient`, and the query key `['credentials']` are used identically across tasks. The create payload shape `{ credential_name, protocol, cred_data:{user,password} }` matches the backend's `Credential.create` handler exactly.
- **Verification-first:** Task 12 Step 4 drives the real backend end-to-end, the point at which any remaining API-shape assumptions are confirmed and corrected.
