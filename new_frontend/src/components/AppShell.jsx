import { useEffect, useState } from 'react'
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { Button, Badge } from './ui.jsx'
import { cn } from '../lib/format.js'

export default function AppShell({
  account,
  activeView,
  navItems,
  onNavigate,
  onLogout,
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
          <div className="panel-strong flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--line)] bg-white/82 text-[var(--ink)] transition hover:bg-white"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Mail Console</p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <p className="truncate font-display text-[1.55rem] leading-none tracking-[-0.04em] text-[var(--ink)]">
                  {navItems.find((item) => item.id === activeView)?.label || 'Tổng quan'}
                </p>
                {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge> : null}
              </div>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{account.displayName || account.username}</p>
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
              <div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Mail Console</p>
                  <p className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-[var(--ink)]">Điều phối mail</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/78 text-[var(--ink)] transition hover:bg-white"
                aria-label="Đóng menu điều hướng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[1.35rem] border border-[var(--line)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(236,247,244,0.86))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--ink)]">{account.displayName || account.username}</p>
                  <p className="truncate text-xs text-[var(--muted)]">@{account.username}</p>
                </div>
                {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge> : null}
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

      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-5 px-3 py-3 sm:px-5 lg:flex-row lg:gap-6 lg:px-8 lg:py-8">
        <aside className="panel-strong hidden rounded-[2rem] p-4 lg:sticky lg:top-8 lg:flex lg:h-[calc(100vh-4rem)] lg:w-[290px] lg:p-5">
          <div className="flex h-full flex-col gap-6">
            <div className="space-y-4">
              <div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">Mail Console</p>
                  <p className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)]">Điều phối mail</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(236,247,244,0.86))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--ink)]">{account.displayName || account.username}</p>
                    <p className="text-xs text-[var(--muted)]">@{account.username}</p>
                  </div>
                  {account.isAdmin ? <Badge tone="accent"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge> : null}
                </div>
              </div>

            </div>

            <nav className="min-h-0 flex-1 flex-col gap-2 overflow-auto">
              {navItems.map((item) => {
                const isActive = item.id === activeView

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-[1.25rem] px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-[rgba(19,93,102,0.12)] text-[var(--accent-strong)]'
                        : 'text-[var(--muted)] hover:bg-white/65 hover:text-[var(--ink)]',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </span>
                    {item.badge ? <Badge tone={isActive ? 'accent' : 'neutral'}>{item.badge}</Badge> : null}
                  </button>
                )
              })}
            </nav>

            <Button variant="ghost" className="hidden justify-start rounded-[1.25rem] lg:inline-flex" icon={LogOut} onClick={onLogout}>
              Đăng xuất
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-5 pt-1 pb-6 lg:pt-0 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
