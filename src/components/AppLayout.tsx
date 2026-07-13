import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { KeyRound, Radar, SlidersHorizontal, Server, ChevronDown, Settings, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuthStore } from '@/stores/auth'

interface NavItem { to: string; label: string; icon: LucideIcon }

const settingsLinks: NavItem[] = [
  { to: '/credentials', label: 'Credential Profiles', icon: KeyRound },
  { to: '/discovery', label: 'Discovery Profiles', icon: Radar },
  { to: '/device-settings', label: 'Device Settings', icon: SlidersHorizontal },
]

const monitoringLinks: NavItem[] = [
  { to: '/inventory', label: 'Inventory', icon: Server },
]

function NavItemLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

const settingsPaths = settingsLinks.map((l) => l.to)

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { username, logout } = useAuthStore()
  const toggleDark = () => document.documentElement.classList.toggle('dark')

  const onSettingsRoute = settingsPaths.some((p) => location.pathname.startsWith(p))
  const [settingsOpen, setSettingsOpen] = useState(onSettingsRoute)

  return (
    <div className="flex h-screen">
      <aside className="flex w-60 flex-col border-r bg-muted/20">
        <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold tracking-tight">
          <Server className="h-5 w-5" />
          Lite-NMS
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monitoring</p>
            {monitoringLinks.map((l) => <NavItemLink key={l.to} {...l} />)}
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="font-medium">Settings</span>
              <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
            </button>
            {settingsOpen && (
              <div className="space-y-1 pl-3">
                {settingsLinks.map((l) => <NavItemLink key={l.to} {...l} />)}
              </div>
            )}
          </div>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b px-4">
          <span className="text-sm text-muted-foreground">{username}</span>
          <Button variant="ghost" size="sm" onClick={toggleDark}>Theme</Button>
          <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/login') }}>Logout</Button>
        </header>
        <main className="flex-1 overflow-auto">
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
