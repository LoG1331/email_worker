import { useEffect, useMemo, useState } from 'react'
import { Copy, Globe2, KeyRound, RefreshCcw, Wrench } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { changeMyPassword, getHealth, pruneRawMime, rotateMyApiKey, updateMe } from '../lib/api.js'
import { cn, formatApiError, formatDateTime, formatRelativeTime, getPermissionScopeLabel, normalizeOptional } from '../lib/format.js'
import { AutoRefreshButton, Badge, Button, CodeBlock, Field, Input, ModalShell, Panel } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function buildDomainSummaries(accessibleDomains, permissions) {
  const domainMap = new Map()

  accessibleDomains.forEach((domain) => {
    domainMap.set(domain, {
      domain,
      permissions: [],
      activeCount: 0,
    })
  })

  permissions.forEach((permission) => {
    const domainKey = permission.domain
    if (!domainMap.has(domainKey)) {
      domainMap.set(domainKey, {
        domain: domainKey,
        permissions: [],
        activeCount: 0,
      })
    }

    const summary = domainMap.get(domainKey)
    summary.permissions.push(permission)

    if (permission.status === 'active') {
      summary.activeCount += 1
    }
  })

  return Array.from(domainMap.values()).sort((left, right) => left.domain.localeCompare(right.domain))
}

export default function OverviewView({
  token,
  account,
  accessibleDomains,
  sessionExpiresAt,
  onRefreshAccount,
  onRefreshSession,
}) {
  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [profileForm, setProfileForm] = useState({
    displayName: account.displayName || '',
    telegramId: account.telegramId || '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [refreshingSession, setRefreshingSession] = useState(false)
  const [pruning, setPruning] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [generatingApiKey, setGeneratingApiKey] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState('')

  const domainSummaries = useMemo(
    () => buildDomainSummaries(accessibleDomains, account.permissions),
    [accessibleDomains, account.permissions],
  )

  async function loadHealth({ showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingHealth(true)
    }

    try {
      const response = await getHealth()
      setHealth(response)
      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    setProfileForm({
      displayName: account.displayName || '',
      telegramId: account.telegramId || '',
    })
  }, [account.displayName, account.telegramId])

  useEffect(() => {
    void loadHealth()
  }, [])

  const refreshNow = useAutoRefresh(async () => {
    await loadHealth({
      showLoading: false,
      showError: false,
    })
  }, 10000)

  async function handleProfileSubmit(event) {
    event.preventDefault()
    setSavingProfile(true)

    try {
      await updateMe(token, {
        displayName: profileForm.displayName,
        telegramId: normalizeOptional(profileForm.telegramId),
      })
      await onRefreshAccount()
      toast.success('Đã cập nhật hồ sơ')
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setChangingPassword(true)

    try {
      await changeMyPassword(token, passwordForm)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
      })
      toast.success('Đã đổi mật khẩu')
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleSessionRefresh() {
    setRefreshingSession(true)

    try {
      await onRefreshSession()
      toast.success('Đã gia hạn phiên')
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setRefreshingSession(false)
    }
  }

  async function handlePrune() {
    setPruning(true)

    try {
      const result = await pruneRawMime(token)
      toast.success(result.skipped ? 'Dọn MIME gốc bị bỏ qua theo chu kỳ' : `Đã dọn ${result.updated} bản ghi MIME gốc`)
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setPruning(false)
    }
  }

  async function handleCreateApiKey() {
    setGeneratingApiKey(true)

    try {
      const response = await rotateMyApiKey(token)
      setGeneratedApiKey(response.apiKey)
      setApiKeyModalOpen(true)
      await onRefreshAccount()
      toast.success('Đã tạo API key mới')
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setGeneratingApiKey(false)
    }
  }

  async function handleCopyApiKey() {
    try {
      await navigator.clipboard.writeText(generatedApiKey)
      toast.success('Đã copy API key')
    } catch {
      toast.error('Không copy được API key')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshButton onClick={refreshNow} />
          {loadingHealth ? <Badge tone="warning">Đang đồng bộ trạng thái…</Badge> : null}
          <Badge tone={health?.ok ? 'success' : 'warning'}>{health?.ok ? 'Hệ thống ổn định' : 'Chưa rõ trạng thái'}</Badge>
          {health?.storage?.engine ? <Badge tone="neutral">{health.storage.engine}</Badge> : null}
        </div>

        <Button size="sm" variant="secondary" icon={RefreshCcw} loading={refreshingSession} onClick={handleSessionRefresh}>
          Gia hạn phiên
        </Button>
      </div>

      <Panel
        eyebrow="Hồ sơ"
        title={`@${account.username}`}
        tone="sage"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={account.status === 'active' ? 'success' : 'warning'}>{account.status}</Badge>
            {account.isAdmin ? <Badge tone="accent">Admin toàn cục</Badge> : null}
            <Button size="sm" variant="secondary" onClick={() => setShowPasswordForm((current) => !current)}>
              {showPasswordForm ? 'Ẩn đổi mật khẩu' : 'Đổi mật khẩu'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={KeyRound}
              loading={generatingApiKey}
              onClick={handleCreateApiKey}
            >
              Tạo API key
            </Button>
          </div>
        )}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Tên hiển thị</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{account.displayName || 'Chưa đặt'}</p>
            </div>
            <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Telegram</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{account.telegramId || 'Chưa đặt'}</p>
            </div>
            <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Hết hạn phiên</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{sessionExpiresAt ? formatDateTime(sessionExpiresAt) : 'Chưa rõ'}</p>
            </div>
            <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Lần cuối</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatRelativeTime(account.lastSeenAt)}</p>
            </div>
          </div>

          <div className="grid gap-4">
            <form className="grid gap-3" onSubmit={handleProfileSubmit}>
              <Field label="Tên hiển thị">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  value={profileForm.displayName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Tên hiển thị"
                />
              </Field>
              <Field label="Telegram ID">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  value={profileForm.telegramId}
                  onChange={(event) => setProfileForm((current) => ({ ...current, telegramId: event.target.value }))}
                  placeholder="123456789"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={savingProfile}>Lưu hồ sơ</Button>
              </div>
            </form>

            {showPasswordForm ? (
              <form className="grid gap-3 rounded-[1.2rem] border border-[var(--line)] bg-white/66 p-4" onSubmit={handlePasswordSubmit}>
                <input className="sr-only" readOnly tabIndex={-1} autoComplete="username" value={account.username} />
                <Field label="Mật khẩu hiện tại">
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  />
                </Field>

                <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự">
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" loading={changingPassword}>
                    Cập nhật mật khẩu
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          eyebrow="Tổng quan"
          title="Domain được cấp"
          tone="slate"
        action={<Badge tone="accent">{domainSummaries.length} domain</Badge>}
        >
          {domainSummaries.length ? (
            <div className="grid gap-2.5">
              {domainSummaries.map((summary) => (
                <div key={summary.domain} className="rounded-[1.15rem] border border-[var(--line)] bg-white/74 px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Globe2 className="h-4 w-4 text-[var(--accent)]" />
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{summary.domain}</p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {summary.permissions.length
                          ? `${summary.activeCount} quyền đang hoạt động`
                          : 'Truy cập từ phiên hiện tại'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {summary.permissions.length ? <Badge tone="success">Vận hành</Badge> : null}
                      <Badge tone="neutral">{summary.permissions.length}</Badge>
                    </div>
                  </div>

                  {summary.permissions.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.permissions.slice(0, 4).map((permission) => (
                        <Badge key={permission.id} tone="success">
                          {getPermissionScopeLabel(permission)}
                        </Badge>
                      ))}
                      {summary.permissions.length > 4 ? <Badge tone="neutral">+{summary.permissions.length - 4}</Badge> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/58 px-5 py-6 text-sm text-[var(--muted)]">
              Tài khoản hiện chưa có domain khả dụng.
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="Ops"
          title="Hệ thống"
          tone="sand"
          action={account.isAdmin ? <Badge tone="accent">Công cụ admin</Badge> : <Badge tone="neutral">Chỉ xem</Badge>}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Dịch vụ</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{health?.service || 'Không rõ'}</p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Môi trường</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{health?.nodeEnv || 'Không rõ'}</p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/72 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Giờ hệ thống</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{health?.systemTime ? formatDateTime(health.systemTime) : 'Không rõ'}</p>
              </div>
            </div>

            {account.isAdmin ? (
              <Button size="sm" icon={Wrench} loading={pruning} onClick={handlePrune}>
                Dọn MIME gốc
              </Button>
            ) : (
              <div className={cn('text-sm text-[var(--muted)]')}>
                Chỉ admin toàn cục mới được chạy tác vụ bảo trì.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <ModalShell
        open={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        eyebrow="API key"
        title="API key mới"
        description="Key này chỉ hiện lại đúng một lần. Lưu lại trước khi đóng."
        tone="ember"
        size="md"
        action={<Badge tone="accent">Đã tạo mới</Badge>}
      >
        <div className="space-y-4">
          <CodeBlock value={generatedApiKey || 'N/A'} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Copy} onClick={handleCopyApiKey} disabled={!generatedApiKey}>
              Sao chép API key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setApiKeyModalOpen(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}
