import { useEffect, useState } from 'react'
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { Button, Badge } from './ui.jsx'
import { cn } from '../lib/format.js'

export default function AppShell({
  account,
  activeView,
  accessibleDomains,
  navItems,
  onNavigate,
  onLogout,
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeItem = navItems.find((item) => item.id === activeView)
  const permissionCount = account.permissions?.length || 0
  const accessibleDomainCount = accessibleDomains.length

  useEffect(() => {
    if (!mobileNavOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavOpen])

  function handleMobileNavigate(viewId) {
    setMobileNavOpen(false)
    onNavigate(viewId)
  }

  return (
    <div className="app-shell">
      <div className="lg:hidden">
        <div className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
          <div className="panel-strong rounded-[1.1rem] px-3 py-2">
            <div className="relative flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-[var(--line)] bg-white/82 text-[var(--ink)] transition hover:bg-white"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{activeItem?.label || 'Tổng quan'}</p>
                  {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'fixed inset-0 z-40 bg-[rgba(17,27,28,0.34)] backdrop-blur-sm transition-opacity duration-200',
            mobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setMobileNavOpen(false)}
        />

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[340px] border-r border-white/70 bg-[rgba(255,252,247,0.96)] px-4 py-4 shadow-[0_34px_70px_-30px_rgba(13,31,32,0.72)] backdrop-blur-2xl transition-transform duration-300',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-full flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Mail Console</p>

              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/78 text-[var(--ink)] transition hover:bg-white"
                aria-label="Đóng menu điều hướng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[1.15rem] border border-[var(--line)] bg-white/78 p-3 shadow-[0_20px_34px_-28px_rgba(12,46,50,0.34)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{account.displayName || account.username}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">@{account.username}</p>
                </div>
                {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge> : null}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{accessibleDomainCount} domain</Badge>
                <Badge tone="neutral">{permissionCount} quyền</Badge>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-2 overflow-auto">
              {navItems.map((item) => {
                const isActive = item.id === activeView

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMobileNavigate(item.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[1.15rem] px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-[linear-gradient(135deg,var(--accent)_0%,#20828d_100%)] text-white shadow-[0_18px_30px_-22px_rgba(19,93,102,0.46)]'
                        : 'bg-white/72 text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </span>
                    {item.badge ? <Badge tone={isActive ? 'neutral' : 'accent'}>{item.badge}</Badge> : null}
                  </button>
                )
              })}
            </nav>

            <Button variant="ghost" className="justify-start rounded-[1.25rem]" icon={LogOut} onClick={onLogout}>
              Đăng xuất
            </Button>
          </div>
        </aside>
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 px-3 py-3 sm:px-5 lg:flex-row lg:gap-4 lg:px-6 lg:py-6">
        <aside className="panel-strong relative hidden overflow-hidden rounded-[1.45rem] p-2.5 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[198px]">
          <div className="relative flex h-full flex-col gap-2">
            <section className="rounded-[1rem] border border-[var(--line)] bg-white/82 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Mail Console</p>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{account.displayName || account.username}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">@{account.username}</p>
                </div>
                {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3 w-3" />Admin</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{accessibleDomainCount} domain</Badge>
                <Badge tone="neutral">{permissionCount} quyền</Badge>
              </div>
            </section>

            <nav className="min-h-0 flex flex-1 flex-col gap-2 overflow-auto">
              {navItems.map((item) => {
                const isActive = item.id === activeView

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-[0.95rem] border px-2.5 py-2 text-left transition-all',
                      isActive
                        ? 'border-[rgba(19,93,102,0.12)] bg-[linear-gradient(135deg,rgba(19,93,102,0.14),rgba(19,93,102,0.06))] text-[var(--accent-strong)] shadow-[0_18px_28px_-24px_rgba(19,93,102,0.58)]'
                        : 'border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-white/70 hover:text-[var(--ink)]',
                    )}
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" />
                        <span className="text-[12px] font-semibold">{item.label}</span>
                      </span>
                      {item.badge ? <Badge tone={isActive ? 'accent' : 'neutral'}>{item.badge}</Badge> : null}
                    </button>
                )
              })}
            </nav>

            <Button variant="ghost" size="sm" className="hidden justify-start rounded-[0.95rem] lg:inline-flex" icon={LogOut} onClick={onLogout}>
              Đăng xuất
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3.5 pt-1 pb-6 lg:pt-0 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
