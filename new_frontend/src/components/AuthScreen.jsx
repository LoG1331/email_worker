import { useState } from 'react'
import { ArrowRight, LockKeyhole, ScanSearch, ShieldEllipsis } from 'lucide-react'
import { Button, Field, Input } from './ui.jsx'
import { getApiBaseUrl } from '../lib/api.js'

export default function AuthScreen({ onLogin }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await onLogin(form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel-strong order-2 rounded-[2.5rem] p-7 sm:p-8 lg:order-1 lg:p-10">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Domain-first mail operations</p>
              <h1 className="font-display text-4xl leading-[0.96] tracking-[-0.05em] text-[var(--ink)] sm:text-5xl lg:text-6xl">
                Một bảng điều khiển gọn, nhanh và bám sát backend mới.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
                Dành cho vận hành mail đa domain với session JWT, phân quyền theo domain hoặc mailbox,
                nhóm email theo `email_id`, và toàn bộ flow quản trị nằm trong một web app tối giản.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="muted-card rounded-[1.5rem] p-4">
                <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
                <p className="mt-4 text-sm font-bold text-[var(--ink)]">JWT session web auth</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Login bằng username/password, không lệ thuộc API key.</p>
              </div>
              <div className="muted-card rounded-[1.5rem] p-4">
                <ScanSearch className="h-5 w-5 text-[var(--warning)]" />
                <p className="mt-4 text-sm font-bold text-[var(--ink)]">Inbox + batch fetch</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Làm việc trực tiếp với mail ID, inbox route và batch route.</p>
              </div>
              <div className="muted-card rounded-[1.5rem] p-4">
                <ShieldEllipsis className="h-5 w-5 text-[var(--success)]" />
                <p className="mt-4 text-sm font-bold text-[var(--ink)]">RBAC rõ ràng</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Phân biệt admin toàn cục, domain admin và mailbox operator.</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Backend endpoint</p>
              <p className="mt-2 font-mono text-sm text-[var(--ink)]">{getApiBaseUrl()}</p>
            </div>
          </div>
        </section>

        <section className="panel panel-tone-ocean order-1 rounded-[2.5rem] p-7 sm:p-8 lg:order-2 lg:p-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--accent)]">Đăng nhập</p>
              <h2 className="font-display text-4xl tracking-[-0.04em] text-[var(--ink)]">Mail Console</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Frontend này chỉ dùng session web của backend mới. Phần API key được để cho route/consumer khác.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <Field label="Username">
                <Input
                  autoFocus
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="admin"
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" size="lg" className="w-full justify-center" icon={ArrowRight} loading={submitting}>
                Vào bảng điều khiển
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
