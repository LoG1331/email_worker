import { useEffect, useMemo, useState } from 'react'
import { Copy, Globe2, KeyRound, RefreshCcw, Wrench } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { changeMyPassword, getHealth, getMaintenanceStorage, pruneEmails, pruneRawMime, rotateMyApiKey, updateMe } from '../lib/api.js'
import { cn, formatApiError, formatBytes, formatDateTime, formatRelativeTime, getPermissionScopeLabel, normalizeOptional } from '../lib/format.js'
import { AutoRefreshButton, Badge, Button, Checkbox, CodeBlock, Field, Input, ModalShell, Panel } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'
const STORAGE_WARNING_BYTES = 10 * 1024 * 1024 * 1024
const STORAGE_DANGER_BYTES = 20 * 1024 * 1024 * 1024

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

function createPruneEmailsForm() {
  return {
    olderThanDays: '30',
    domain: '',
    limit: '5000',
    dryRun: true,
  }
}

function getStorageSeverity(bytes) {
  const normalizedBytes = Number(bytes) || 0
  if (normalizedBytes >= STORAGE_DANGER_BYTES) {
    return 'danger'
  }

  if (normalizedBytes >= STORAGE_WARNING_BYTES) {
    return 'warning'
  }

  return 'success'
}

function getStorageSeverityLabel(bytes) {
  const severity = getStorageSeverity(bytes)
  if (severity === 'danger') {
    return 'Cần dọn gấp'
  }

  if (severity === 'warning') {
    return 'Nên dọn sớm'
  }

  return 'Ổn định'
}

function getStorageCardClass(bytes) {
  const severity = getStorageSeverity(bytes)
  if (severity === 'danger') {
    return 'border-[rgba(160,56,56,0.28)] bg-[rgba(255,238,238,0.92)]'
  }

  if (severity === 'warning') {
    return 'border-[rgba(161,90,28,0.24)] bg-[rgba(255,247,232,0.92)]'
  }

  return 'border-[var(--line)] bg-white/80'
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
  const [storage, setStorage] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [loadingStorage, setLoadingStorage] = useState(false)
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
  const [pruningRawMime, setPruningRawMime] = useState(false)
  const [pruningEmails, setPruningEmails] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [generatingApiKey, setGeneratingApiKey] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState('')
  const [pruneEmailForm, setPruneEmailForm] = useState(createPruneEmailsForm)
  const [lastPruneResult, setLastPruneResult] = useState(null)

  const domainSummaries = useMemo(
    () => buildDomainSummaries(accessibleDomains, account.permissions),
    [accessibleDomains, account.permissions],
  )
  const sqliteSeverity = getStorageSeverity(storage?.sqliteTotalBytes)
  const folderSeverity = getStorageSeverity(storage?.folderBytes)
  const highestStorageSeverity = sqliteSeverity === 'danger' || folderSeverity === 'danger'
    ? 'danger'
    : sqliteSeverity === 'warning' || folderSeverity === 'warning'
      ? 'warning'
      : 'success'

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

  async function loadStorage({ showLoading = true, showError = true } = {}) {
    if (!account.isAdmin) {
      return null
    }

    if (showLoading) {
      setLoadingStorage(true)
    }

    try {
      const response = await getMaintenanceStorage(token)
      setStorage(response.storage || null)
      return response.storage || null
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingStorage(false)
    }
  }

  useEffect(() => {
    setProfileForm({
      displayName: account.displayName || '',
      telegramId: account.telegramId || '',
    })
  }, [account.displayName, account.telegramId])

  useEffect(() => {
    let cancelled = false

    async function bootstrapOverview() {
      setLoadingHealth(true)

      try {
        const response = await getHealth()
        if (!cancelled) {
          setHealth(response)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setLoadingHealth(false)
        }
      }

      if (!account.isAdmin) {
        return
      }

      setLoadingStorage(true)

      try {
        const response = await getMaintenanceStorage(token)
        if (!cancelled) {
          setStorage(response.storage || null)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorage(false)
        }
      }
    }

    void bootstrapOverview()

    return () => {
      cancelled = true
    }
  }, [account.isAdmin, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadHealth({
      showLoading: false,
      showError: false,
    })
    await loadStorage({
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
    setPruningRawMime(true)

    try {
      const result = await pruneRawMime(token)
      await loadStorage({
        showLoading: false,
        showError: false,
      })
      toast.success(result.skipped ? 'Dọn MIME gốc bị bỏ qua theo chu kỳ' : `Đã dọn ${result.updated} bản ghi MIME gốc`)
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setPruningRawMime(false)
    }
  }

  async function handlePruneEmails(event) {
    event.preventDefault()
    setPruningEmails(true)

    try {
      const payload = {
        olderThanDays: Number.parseInt(pruneEmailForm.olderThanDays, 10) || 0,
        dryRun: pruneEmailForm.dryRun,
        limit: Number.parseInt(pruneEmailForm.limit, 10) || 5000,
      }

      const normalizedDomain = normalizeOptional(pruneEmailForm.domain)
      if (normalizedDomain) {
        payload.domain = normalizedDomain
      }

      const result = await pruneEmails(token, payload)
      setLastPruneResult(result)

      if (result.dryRun) {
        toast.success(`Preview ${result.selected}/${result.matched} email có thể dọn`)
      } else {
        await loadStorage({
          showLoading: false,
          showError: false,
        })
        toast.success(`Đã xóa ${result.deleted} email cũ`)
      }
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setPruningEmails(false)
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
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => loadStorage()} loading={loadingStorage}>
                  Làm mới dung lượng
                </Button>
                <Button size="sm" icon={Wrench} loading={pruningRawMime} onClick={handlePrune}>
                  Dọn MIME gốc
                </Button>
              </div>
            ) : (
              <div className={cn('text-sm text-[var(--muted)]')}>
                Chỉ admin toàn cục mới được chạy tác vụ bảo trì.
              </div>
            )}
          </div>

          {account.isAdmin ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/74 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">Storage</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Dung lượng thực tế của SQLite và thư mục chứa DB.</p>
                  </div>
                  {loadingStorage ? <Badge tone="warning">Đang đồng bộ…</Badge> : <Badge tone={highestStorageSeverity}>{getStorageSeverityLabel(Math.max(storage?.sqliteTotalBytes || 0, storage?.folderBytes || 0))}</Badge>}
                </div>

                {highestStorageSeverity !== 'success' ? (
                  <div className={cn(
                    'mt-4 rounded-[1.1rem] border px-4 py-3 text-sm',
                    highestStorageSeverity === 'danger'
                      ? 'border-[rgba(160,56,56,0.28)] bg-[rgba(255,238,238,0.92)] text-[var(--danger)]'
                      : 'border-[rgba(161,90,28,0.24)] bg-[rgba(255,247,232,0.92)] text-[var(--warning)]',
                  )}
                  >
                    {highestStorageSeverity === 'danger'
                      ? 'Dung lượng đã vượt 20 GB. Nên prune email cũ ngay và kiểm tra retention/raw MIME.'
                      : 'Dung lượng đã vượt 10 GB. Nên lên lịch prune email cũ sớm để tránh phình DB.'}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={cn('rounded-[1.1rem] border px-4 py-3', getStorageCardClass(storage?.sqliteTotalBytes))}>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">SQLite tổng</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatBytes(storage?.sqliteTotalBytes)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-[var(--muted)]">{storage ? `${storage.sqliteTotalBytes.toLocaleString('vi-VN')} bytes` : 'Chưa có dữ liệu'}</p>
                      {storage ? <Badge tone={sqliteSeverity}>{getStorageSeverityLabel(storage.sqliteTotalBytes)}</Badge> : null}
                    </div>
                  </div>
                  <div className={cn('rounded-[1.1rem] border px-4 py-3', getStorageCardClass(storage?.folderBytes))}>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Thư mục DB</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatBytes(storage?.folderBytes)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-[var(--muted)]">{storage?.storageDir || 'Chưa có dữ liệu'}</p>
                      {storage ? <Badge tone={folderSeverity}>{getStorageSeverityLabel(storage.folderBytes)}</Badge> : null}
                    </div>
                  </div>
                  <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/80 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">SQLite main</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatBytes(storage?.sqliteBytes)}</p>
                  </div>
                  <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/80 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">WAL / SHM</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{`${formatBytes(storage?.walBytes)} / ${formatBytes(storage?.shmBytes)}`}</p>
                  </div>
                </div>
              </div>

              <form className="rounded-[1.35rem] border border-[var(--line)] bg-white/74 p-4" onSubmit={handlePruneEmails}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">Prune emails</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Xóa mail cũ theo lô và `VACUUM` tự động sau lần chạy thật.</p>
                  </div>
                  <Badge tone={pruneEmailForm.dryRun ? 'warning' : 'accent'}>
                    {pruneEmailForm.dryRun ? 'Preview' : 'Thực thi'}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Cũ hơn (ngày)">
                    <Input
                      className={COMPACT_INPUT_CLASS}
                      inputMode="numeric"
                      value={pruneEmailForm.olderThanDays}
                      onChange={(event) => setPruneEmailForm((current) => ({ ...current, olderThanDays: event.target.value }))}
                      placeholder="30"
                    />
                  </Field>
                  <Field label="Giới hạn mỗi lần">
                    <Input
                      className={COMPACT_INPUT_CLASS}
                      inputMode="numeric"
                      value={pruneEmailForm.limit}
                      onChange={(event) => setPruneEmailForm((current) => ({ ...current, limit: event.target.value }))}
                      placeholder="5000"
                    />
                  </Field>
                  <Field label="Domain" className="sm:col-span-2" hint="Để trống để dọn toàn hệ thống">
                    <Input
                      className={COMPACT_INPUT_CLASS}
                      value={pruneEmailForm.domain}
                      onChange={(event) => setPruneEmailForm((current) => ({ ...current, domain: event.target.value }))}
                      placeholder="example.com"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Checkbox
                      label="Chạy preview trước, chưa xóa thật"
                      checked={pruneEmailForm.dryRun}
                      onChange={(event) => setPruneEmailForm((current) => ({ ...current, dryRun: event.target.checked }))}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="submit" size="sm" loading={pruningEmails}>
                    {pruneEmailForm.dryRun ? 'Xem trước prune' : 'Prune email cũ'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPruneEmailForm(createPruneEmailsForm())
                      setLastPruneResult(null)
                    }}
                  >
                    Reset
                  </Button>
                </div>

                {lastPruneResult ? (
                  <div className="mt-4 rounded-[1.15rem] border border-[var(--line)] bg-white/82 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={lastPruneResult.dryRun ? 'warning' : 'success'}>
                        {lastPruneResult.dryRun ? 'Kết quả preview' : 'Đã chạy prune'}
                      </Badge>
                      <Badge tone="neutral">{`${lastPruneResult.selected}/${lastPruneResult.matched}`}</Badge>
                      <Badge tone="neutral">{`${lastPruneResult.affectedGroups} group ảnh hưởng`}</Badge>
                      {lastPruneResult.hasMore ? <Badge tone="warning">Còn dữ liệu chưa dọn</Badge> : null}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Deleted / Remaining</p>
                        <p className="mt-1 font-semibold text-[var(--ink)]">{`${lastPruneResult.deleted} / ${lastPruneResult.remaining ?? 0}`}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Mốc mail</p>
                        <p className="mt-1 font-semibold text-[var(--ink)]">
                          {lastPruneResult.oldestReceivedAt ? formatDateTime(lastPruneResult.oldestReceivedAt) : 'N/A'}
                          {' → '}
                          {lastPruneResult.newestReceivedAt ? formatDateTime(lastPruneResult.newestReceivedAt) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {lastPruneResult.vacuum ? (
                      <div className="mt-3 rounded-[1rem] border border-[var(--line)] bg-[#fcfaf6] px-3.5 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Vacuum</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                          {`${formatBytes(lastPruneResult.vacuum.before?.totalBytes)} → ${formatBytes(lastPruneResult.vacuum.after?.totalBytes)}`}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {`main ${formatBytes(lastPruneResult.vacuum.before?.sqliteBytes)} → ${formatBytes(lastPruneResult.vacuum.after?.sqliteBytes)}, wal ${formatBytes(lastPruneResult.vacuum.before?.walBytes)} → ${formatBytes(lastPruneResult.vacuum.after?.walBytes)}`}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </form>
            </div>
          ) : null}
        </Panel>
      </div>

      <ModalShell
        open={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        eyebrow="API key"
        title="API key mới"
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
