import { startTransition, useEffect, useMemo, useState } from 'react'
import {
  Crown,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import AppShell from './components/AppShell.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import { getMe, login, logout, refreshSession } from './lib/api.js'
import { formatApiError } from './lib/format.js'
import AdminsView from './views/AdminsView.jsx'
import DomainsView from './views/DomainsView.jsx'
import EmailsView from './views/EmailsView.jsx'
import GroupsView from './views/GroupsView.jsx'
import OverviewView from './views/OverviewView.jsx'
import PermissionsView from './views/PermissionsView.jsx'
import UsersView from './views/UsersView.jsx'

const STORAGE_KEY = 'new_frontend.sessionToken'

const BASE_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'groups', label: 'Groups', icon: FolderKanban },
  { id: 'domains', label: 'Domains', icon: Globe2 },
]

const ADMIN_NAV_ITEMS = [
  { id: 'users', label: 'Users', icon: Users2 },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'admins', label: 'Admins', icon: Crown },
]

const VIEW_LABELS = {
  overview: OverviewView,
  emails: EmailsView,
  groups: GroupsView,
  domains: DomainsView,
  users: UsersView,
  permissions: PermissionsView,
  admins: AdminsView,
}

function readStoredToken() {
  return window.localStorage.getItem(STORAGE_KEY) || ''
}

function readSessionExpiry(token) {
  if (!token) {
    return null
  }

  try {
    const [, encodedPayload] = token.split('.')
    if (!encodedPayload) {
      return null
    }

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(window.atob(padded))
    if (!payload?.exp) {
      return null
    }

    return new Date(payload.exp * 1000).toISOString()
  } catch {
    return null
  }
}

export default function App() {
  const [token, setToken] = useState(() => readStoredToken())
  const [booting, setBooting] = useState(() => Boolean(readStoredToken()))
  const [account, setAccount] = useState(null)
  const [accessibleDomains, setAccessibleDomains] = useState([])
  const [sessionExpiresAt, setSessionExpiresAt] = useState(() => readSessionExpiry(readStoredToken()))
  const [activeView, setActiveView] = useState('overview')

  function persistToken(nextToken) {
    if (nextToken) {
      window.localStorage.setItem(STORAGE_KEY, nextToken)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }

    setToken(nextToken)
    setSessionExpiresAt(readSessionExpiry(nextToken))
  }

  async function syncCurrentAccount(currentToken) {
    const response = await getMe(currentToken)
    setAccount(response.account)
    setAccessibleDomains(response.accessibleDomains)
    return response
  }

  useEffect(() => {
    if (!token) {
      setBooting(false)
      setAccount(null)
      setAccessibleDomains([])
      setSessionExpiresAt(null)
      setActiveView('overview')
      return
    }

    let cancelled = false
    setBooting(true)

    async function loadSession() {
      try {
        await syncCurrentAccount(token)
      } catch (error) {
        if (!cancelled) {
          persistToken('')
          toast.error(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setBooting(false)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [token])

  const navItems = useMemo(() => {
    if (!account) {
      return BASE_NAV_ITEMS
    }

    return account.isAdmin ? [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS
  }, [account])

  async function handleLogin(credentials) {
    try {
      const response = await login(credentials)
      persistToken(response.sessionToken)
      setSessionExpiresAt(response.expiresAt)
      setAccount(response.account)
      const meResponse = await syncCurrentAccount(response.sessionToken)
      setAccessibleDomains(meResponse.accessibleDomains)
      toast.success('Đăng nhập thành công')
    } catch (error) {
      toast.error(formatApiError(error))
      throw error
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await logout(token)
      }
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      persistToken('')
      setAccount(null)
      setAccessibleDomains([])
      setSessionExpiresAt(null)
      setActiveView('overview')
    }
  }

  async function handleRefreshSession() {
    if (!token) {
      return null
    }

    const response = await refreshSession(token)
    persistToken(response.sessionToken)
    setSessionExpiresAt(response.expiresAt)
    return response
  }

  async function handleRefreshAccount() {
    if (!token) {
      return null
    }

    return syncCurrentAccount(token)
  }

  if (booting) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="panel-strong rounded-[2rem] px-8 py-10 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--accent)]">Restoring session</p>
          <h1 className="mt-3 font-display text-4xl tracking-[-0.04em] text-[var(--ink)]">Mail Console</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Đang đồng bộ session JWT và nạp hồ sơ người dùng.</p>
        </div>
      </main>
    )
  }

  if (!token || !account) {
    return <AuthScreen onLogin={handleLogin} />
  }

  const ActiveView = VIEW_LABELS[activeView] || OverviewView

  return (
    <AppShell
      account={account}
      activeView={activeView}
      navItems={navItems}
      onNavigate={(viewId) => startTransition(() => setActiveView(viewId))}
      onLogout={handleLogout}
    >
      <ActiveView
        token={token}
        account={account}
        accessibleDomains={accessibleDomains}
        sessionExpiresAt={sessionExpiresAt}
        onRefreshAccount={handleRefreshAccount}
        onRefreshSession={handleRefreshSession}
      />
    </AppShell>
  )
}
