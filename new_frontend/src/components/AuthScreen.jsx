import { useState } from 'react'
import { ArrowRight, ScanSearch } from 'lucide-react'
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
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel-strong order-2 overflow-hidden rounded-[2rem] p-6 sm:p-7 lg:order-1 lg:p-8">
          <div className="max-w-xl space-y-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(19,93,102,0.12)] bg-white/72 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Mail Console
              </div>
              <h1 className="font-display text-[2.6rem] leading-[0.92] tracking-[-0.06em] text-[var(--ink)] sm:text-[3rem] lg:text-[3.4rem]">Mail theo domain.</h1>
            </div>

            <div className="rounded-[1.3rem] border border-[var(--line)] bg-white/65 p-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                <ScanSearch className="h-4 w-4 text-[var(--accent)]" />
                <span>API</span>
              </div>
              <p className="mt-2 font-mono text-[13px] text-[var(--ink)]">{getApiBaseUrl()}</p>
            </div>
          </div>
        </section>

        <section className="panel panel-tone-ocean order-1 overflow-hidden rounded-[2rem] p-6 sm:p-7 lg:order-2 lg:p-8">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Đăng nhập</p>
              <h2 className="font-display text-[2rem] tracking-[-0.05em] text-[var(--ink)] sm:text-[2.35rem]">Mail Console</h2>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Tên đăng nhập">
                <Input
                  autoFocus
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="admin"
                />
              </Field>

              <Field label="Mật khẩu">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" size="lg" className="w-full justify-center" icon={ArrowRight} loading={submitting}>
                Vào hệ thống
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
