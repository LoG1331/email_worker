import { useDeferredValue, useEffect, useState } from 'react'
import { KeyRound, Search, ShieldCheck, UserPlus, UserRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { createUser, getUserById, listUsers, updateUser } from '../lib/api.js'
import { cn, formatApiError, formatDateTime, getPermissionScopeLabel, normalizeOptional } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { AutoRefreshButton, Badge, Button, CompactPagination, Field, Input, ModalShell, Panel, Select } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const USER_STATUSES = ['active', 'disabled']
const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function emptyCreateForm() {
  return {
    username: '',
    password: '',
    displayName: '',
    telegramId: '',
    status: 'active',
  }
}

function UserCreateModal({ open, form, saving, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Người dùng"
      title="Tạo người dùng mới"
      description="Tạo tài khoản web mới với tên đăng nhập, mật khẩu, tên hiển thị và Telegram ID nếu cần."
      tone="ocean"
      size="md"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Tên đăng nhập">
          <Input autoComplete="username" value={form.username} onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))} />
        </Field>
        <Field label="Mật khẩu">
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))} />
        </Field>
        <Field label="Tên hiển thị">
          <Input value={form.displayName} onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))} />
        </Field>
        <Field label="Telegram ID">
          <Input value={form.telegramId} onChange={(event) => onChange((current) => ({ ...current, telegramId: event.target.value }))} />
        </Field>
        <Field label="Trạng thái" className="md:col-span-2">
          <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
            {USER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={UserPlus} loading={saving}>Tạo người dùng</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

function UserDetailModal({
  open,
  user,
  form,
  saving,
  loading,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Người dùng"
      title={user ? `@${user.username}` : 'Chi tiết người dùng'}
      tone="ember"
      size="xl"
      action={user ? (
        <div className="flex flex-wrap items-center gap-2">
          {loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          <Badge tone={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge>
          <Badge tone={user.isAdmin ? 'accent' : 'neutral'}>{user.isAdmin ? 'Admin' : 'Người dùng'}</Badge>
          <Badge tone="neutral">{user.permissions.length} quyền</Badge>
        </div>
      ) : loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {user ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[1.2rem] border border-[var(--line)] bg-white/74 px-4 py-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_170px_170px_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Tên hiển thị</p>
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{user.displayName || '@' + user.username}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Telegram</p>
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{user.telegramId || 'Chưa đặt'}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Tạo lúc</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Hoạt động</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(user.lastSeenAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {user.hasPassword ? <Badge tone="success">Có mật khẩu</Badge> : <Badge tone="warning">Chưa đặt mật khẩu</Badge>}
              {user.hasApiKey ? <Badge tone="accent">API key</Badge> : null}
            </div>
          </div>

          <form className="rounded-[1.35rem] border border-[var(--line)] bg-white/82 p-4 sm:p-5" onSubmit={onSubmit}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Chỉnh người dùng</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{user.hasApiKey ? 'Đã bật API' : 'Chỉ web'}</Badge>
                <Badge tone="accent">{user.permissions.length} quyền</Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
              <Field label="Tên đăng nhập">
                <Input className={COMPACT_INPUT_CLASS} autoComplete="username" value={form.username} onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))} />
              </Field>
              <Field label="Tên hiển thị">
                <Input className={COMPACT_INPUT_CLASS} value={form.displayName} onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))} />
              </Field>
              <Field label="Trạng thái">
                <Select className={COMPACT_INPUT_CLASS} value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
                  {USER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </Select>
              </Field>
              <Field label="Telegram ID">
                <Input className={COMPACT_INPUT_CLASS} value={form.telegramId} onChange={(event) => onChange((current) => ({ ...current, telegramId: event.target.value }))} />
              </Field>
              <Field label="Mật khẩu mới" className="md:col-span-2 xl:col-span-2">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Bỏ trống nếu giữ nguyên"
                  value={form.password}
                  onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={saving}>Lưu</Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </form>

          <section className="rounded-[1.35rem] border border-[var(--line)] bg-white/82 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Quyền</p>
              <Badge tone="accent">{user.permissions.length}</Badge>
            </div>

            {user.permissions.length ? (
              <div className="grid gap-2">
                {user.permissions.map((permission) => (
                  <div key={permission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{getPermissionScopeLabel(permission)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="success">Vận hành</Badge>
                      <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Chưa có quyền nào.</p>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải thông tin người dùng...
        </div>
      )}
    </ModalShell>
  )
}

export default function UsersView({ token }) {
  const [users, setUsers] = useState([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    limit: 50,
    offset: 0,
  })
  const deferredQuery = useDeferredValue(filters.q)
  const [telegramLookup, setTelegramLookup] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm())
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    displayName: '',
    telegramId: '',
    status: 'active',
  })
  const [savingUser, setSavingUser] = useState(false)

  async function loadUsers(
    preferredUserId = selectedUserId,
    query = {
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    },
    { showLoading = true, showError = true } = {},
  ) {
    if (showLoading) {
      setLoadingUsers(true)
    }

    try {
      const response = await listUsers(token, query)
      if (!response.users.length && query.offset > 0 && response.total <= query.offset) {
        setFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setUsers(response.users)
      setTotalUsers(response.total)

      if (!response.users.length) {
        setSelectedUserId(null)
        setSelectedUser(null)
        return response
      }

      if (preferredUserId && !response.users.some((user) => user.id === preferredUserId)) {
        setSelectedUserId(null)
        setSelectedUser(null)
      }

      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadSelectedUserDetail(userId = selectedUserId, { showLoading = true, showError = true } = {}) {
    if (!userId) {
      return null
    }

    if (showLoading) {
      setLoadingDetail(true)
    }

    try {
      const response = await getUserById(token, userId)
      setSelectedUser(response.user)
      setEditForm({
        username: response.user.username,
        password: '',
        displayName: response.user.displayName || '',
        telegramId: response.user.telegramId || '',
        status: response.user.status,
      })
      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    void loadUsers(null, {
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery, filters.limit, filters.offset, token])

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    void loadSelectedUserDetail(selectedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadUsers(selectedUserId, {
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    }, {
      showLoading: false,
      showError: false,
    })

    if (selectedUserId) {
      await loadSelectedUserDetail(selectedUserId, {
        showLoading: false,
        showError: false,
      })
    }
  }, 10000)

  async function handleCreate(event) {
    event.preventDefault()
    setCreatingUser(true)

    try {
      const response = await createUser(token, {
        ...createForm,
        telegramId: normalizeOptional(createForm.telegramId),
        generateApiKey: false,
      })
      toast.success('Đã tạo người dùng')
      setCreateForm(emptyCreateForm())
      setCreateModalOpen(false)
      setSelectedUserId(response.user.id)
      setFilters((current) => ({ ...current, offset: 0 }))
      await loadUsers(response.user.id, {
        q: deferredQuery,
        limit: filters.limit,
        offset: 0,
      }, { showLoading: false, showError: false })
      await loadSelectedUserDetail(response.user.id, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setCreatingUser(false)
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()

    if (!selectedUserId) {
      return
    }

    setSavingUser(true)

    try {
      await updateUser(token, selectedUserId, {
        username: editForm.username,
        displayName: editForm.displayName,
        telegramId: normalizeOptional(editForm.telegramId),
        status: editForm.status,
        ...(editForm.password ? { password: editForm.password } : {}),
      })
      toast.success('Đã cập nhật người dùng')
      await loadUsers(selectedUserId, {
        q: deferredQuery,
        limit: filters.limit,
        offset: filters.offset,
      }, { showLoading: false, showError: false })
      await loadSelectedUserDetail(selectedUserId, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setSavingUser(false)
    }
  }

  async function handleLookupTelegram(event) {
    event.preventDefault()

    if (!telegramLookup.trim()) {
      toast.error('Nhập telegram ID để lookup')
      return
    }

    try {
      const response = await listUsers(token, {
        telegramId: telegramLookup.trim(),
        limit: 1,
        offset: 0,
      })

      if (!response.users.length) {
        toast.error('Không tìm thấy người dùng theo Telegram ID')
        return
      }

      setSelectedUserId(response.users[0].id)
      toast.success('Đã tìm thấy người dùng theo Telegram ID')
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  function handleCloseDetail() {
    setSelectedUserId(null)
    setSelectedUser(null)
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Người dùng</p>
            <AutoRefreshButton onClick={refreshNow} />
            <Badge tone="neutral">{users.length} / {totalUsers} người dùng</Badge>
            {loadingUsers ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/68 p-3">
              <Field label="Tìm theo username / tên hiển thị / Telegram">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, offset: 0 }))}
                  placeholder="@alice hoặc 100000001"
                />
              </Field>
            </div>

            <form className="rounded-[1.35rem] border border-[var(--line)] bg-white/68 p-3" onSubmit={handleLookupTelegram}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label="Tra theo Telegram ID">
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    value={telegramLookup}
                    onChange={(event) => setTelegramLookup(event.target.value)}
                    placeholder="123456789"
                  />
                </Field>
                <Button type="submit" size="sm" variant="secondary" icon={Search}>Tra cứu</Button>
              </div>
            </form>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Người dùng"
        title="Danh sách người dùng"
        description="Danh sách người dùng là vùng làm việc chính. Chọn một dòng để mở hồ sơ chi tiết và chỉnh sửa trong modal."
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{users.length} hiển thị</Badge>
            <CompactPagination
              total={totalUsers}
              count={users.length}
              offset={filters.offset}
              limit={filters.limit}
              onLimitChange={(limit) => setFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            <Button size="sm" icon={UserPlus} onClick={() => setCreateModalOpen(true)}>
              Tạo người dùng
            </Button>
          </div>
        )}
      >
        {users.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_180px_170px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Người dùng / quyền</p>
              <p>Telegram / API</p>
              <p className="text-right">Tạo lúc</p>
            </div>

            <div className="grid gap-0">
              {users.map((user) => {
                const isActive = selectedUserId === user.id

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      'grid w-full gap-4 border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
                      'lg:grid-cols-[minmax(0,1.6fr)_180px_170px] lg:items-center',
                      isActive
                        ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
                        : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
                    )}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold text-[var(--ink)]">@{user.username}</p>
                        <p className="truncate text-sm text-[var(--muted)]">{user.displayName || 'Chưa đặt tên hiển thị'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge>
                        {user.isAdmin ? <Badge tone="accent">Admin</Badge> : null}
                        <Badge tone="neutral">{user.permissionCount} quyền</Badge>
                        <Badge tone={user.hasApiKey ? 'accent' : 'neutral'}>{user.hasApiKey ? 'API key' : 'Không có API key'}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-1.5 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">TG</span>
                        <span className="truncate font-medium text-[var(--ink)]">{user.telegramId || 'Chưa đặt'}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                        <span className="truncate text-xs font-medium text-[var(--muted)]">Lần cuối {formatDateTime(user.lastSeenAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm text-[var(--muted)] lg:justify-end">
                      <p className="font-medium">{formatDateTime(user.createdAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có người dùng để hiển thị</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Tạo người dùng mới hoặc đổi từ khóa tìm kiếm để hiện lại danh sách.
            </p>
          </div>
        )}
      </Panel>

      <UserCreateModal
        open={createModalOpen}
        form={createForm}
        saving={creatingUser}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => setCreateModalOpen(false)}
      />

      <UserDetailModal
        open={Boolean(selectedUserId)}
        user={selectedUser}
        form={editForm}
        saving={savingUser}
        loading={loadingDetail}
        onChange={setEditForm}
        onSubmit={handleUpdate}
        onClose={handleCloseDetail}
      />
    </div>
  )
}
