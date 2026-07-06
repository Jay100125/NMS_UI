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
