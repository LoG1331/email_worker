import { useEffect, useState } from 'react'
import { ShieldPlus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createPermission,
  deletePermission,
  getPermission,
  listDomains,
  listPermissions,
  listUsers,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime, getPermissionScopeLabel, normalizeOptional } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { AutoRefreshButton, Badge, Button, CompactPagination, Field, Input, ModalShell, Panel, Select } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const STATUS_OPTIONS = ['active', 'disabled']
const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function emptyPermissionCreateForm() {
  return {
    userId: '',
    username: '',
    domain: '',
    status: 'active',
  }
}

function PermissionCreateModal({ open, users, domains, form, saving, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Quyền"
      title="Cấp quyền mới"
      tone="ocean"
      size="lg"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="User ID" hint="Điền userId hoặc username">
          <Input
            className={COMPACT_INPUT_CLASS}
            value={form.userId}
            onChange={(event) => onChange((current) => ({ ...current, userId: event.target.value }))}
            placeholder="12"
          />
        </Field>
        <Field label="Username" hint="Có gợi ý, không bị giới hạn 200 dòng">
          <Input
            className={COMPACT_INPUT_CLASS}
            list="permission-user-suggestions"
            value={form.username}
            onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))}
            placeholder="alice"
          />
          <datalist id="permission-user-suggestions">
            {users.map((user) => (
              <option key={user.id} value={user.username}>
                {user.displayName ? `${user.username} · ${user.displayName}` : user.username}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Domain" hint="Có gợi ý, vẫn có thể gõ tay">
          <Input
            className={COMPACT_INPUT_CLASS}
            list="permission-domain-suggestions"
            value={form.domain}
            onChange={(event) => onChange((current) => ({ ...current, domain: event.target.value }))}
            placeholder="example.com"
          />
          <datalist id="permission-domain-suggestions">
            {domains.map((domain) => (
              <option key={domain.domain} value={domain.domain} />
            ))}
          </datalist>
        </Field>
        <Field label="Trạng thái">
          <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={ShieldPlus} loading={saving}>Tạo quyền</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

function PermissionDetailModal({
  open,
  permission,
  loading,
  deleting,
  onDelete,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Quyền"
      title={permission ? getPermissionScopeLabel(permission) : 'Chi tiết quyền'}
      tone="sage"
      size="lg"
      action={loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {permission ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người dùng</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">@{permission.user.username}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người cấp</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{permission.grantedBy?.username || permission.grantedBy?.label || 'Không rõ'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Tạo lúc</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(permission.createdAt)}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Cập nhật</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(permission.updatedAt)}</p>
            </div>
          </div>

          <section className="rounded-[1.4rem] border border-[var(--line)] bg-white/82 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Vận hành</Badge>
              <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
              <Badge tone="neutral">{permission.domain}</Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" variant="danger" icon={Trash2} loading={deleting} onClick={onDelete}>Xóa quyền</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải chi tiết quyền...
        </div>
      )}
    </ModalShell>
  )
}

export default function PermissionsView({ token }) {
  const [filters, setFilters] = useState({
    userId: '',
    domain: '',
    status: '',
    limit: 50,
    offset: 0,
  })
  const [userOptions, setUserOptions] = useState([])
  const [domainOptions, setDomainOptions] = useState([])
  const [permissions, setPermissions] = useState([])
  const [totalPermissions, setTotalPermissions] = useState(0)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [selectedPermissionId, setSelectedPermissionId] = useState(null)
  const [selectedPermission, setSelectedPermission] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingPermission, setCreatingPermission] = useState(false)
  const [deletingPermission, setDeletingPermission] = useState(false)
  const [createForm, setCreateForm] = useState(emptyPermissionCreateForm())

  async function loadOptions({ showError = true } = {}) {
    try {
      const [usersResponse, domainsResponse] = await Promise.all([
        listUsers(token, { limit: 200, offset: 0 }),
        listDomains(token, { limit: 200, offset: 0 }),
      ])
      setUserOptions(usersResponse.users)
      setDomainOptions(domainsResponse.domains)
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    }
  }

  async function loadPermissions(preferredPermissionId = selectedPermissionId, activeFilters = filters, { showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingPermissions(true)
    }

    try {
      const response = await listPermissions(token, activeFilters)
      if (!response.permissions.length && activeFilters.offset > 0 && response.total <= activeFilters.offset) {
        setFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setPermissions(response.permissions)
      setTotalPermissions(response.total)

      if (!response.permissions.length) {
        setSelectedPermissionId(null)
        setSelectedPermission(null)
        return response
      }

      if (preferredPermissionId && !response.permissions.some((permission) => permission.id === preferredPermissionId)) {
        setSelectedPermissionId(null)
        setSelectedPermission(null)
      }

      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingPermissions(false)
    }
  }

  async function loadPermissionDetail(permissionId = selectedPermissionId, { showLoading = true, showError = true } = {}) {
    if (!permissionId) {
      return null
    }

    if (showLoading) {
      setLoadingDetail(true)
    }

    try {
      const response = await getPermission(token, permissionId)
      setSelectedPermission(response.permission)
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
    void loadOptions({ showError: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void loadPermissions(null, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.userId, filters.domain, filters.status, filters.limit, filters.offset])

  useEffect(() => {
    if (!selectedPermissionId) {
      setSelectedPermission(null)
      return
    }

    void loadPermissionDetail(selectedPermissionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPermissionId, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadPermissions(selectedPermissionId, filters, {
      showLoading: false,
      showError: false,
    })

    await loadOptions({ showError: false })

    if (selectedPermissionId) {
      await loadPermissionDetail(selectedPermissionId, {
        showLoading: false,
        showError: false,
      })
    }
  }, 10000)

  async function handleCreate(event) {
    event.preventDefault()
    setCreatingPermission(true)

    try {
      const response = await createPermission(token, {
        ...createForm,
        userId: normalizeOptional(createForm.userId),
        username: normalizeOptional(createForm.username),
        domain: normalizeOptional(createForm.domain),
      })
      toast.success('Đã tạo quyền')
      setCreateForm(emptyPermissionCreateForm())
      setCreateModalOpen(false)
      setSelectedPermissionId(response.permission.id)
      const nextFilters = {
        ...filters,
        offset: 0,
      }
      setFilters(nextFilters)
      await loadPermissions(response.permission.id, nextFilters, { showLoading: false, showError: false })
      await loadPermissionDetail(response.permission.id, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setCreatingPermission(false)
    }
  }

  async function handleDelete() {
    if (!selectedPermissionId) {
      return
    }

    setDeletingPermission(true)

    try {
      await deletePermission(token, selectedPermissionId)
      toast.success('Đã xóa quyền')
      setSelectedPermissionId(null)
      setSelectedPermission(null)
      await loadPermissions(null, filters, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingPermission(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Quyền</p>
              <AutoRefreshButton onClick={refreshNow} />
              <Badge tone="neutral">{permissions.length} / {totalPermissions} quyền</Badge>
              {loadingPermissions ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.4rem] border border-[var(--line)] bg-white/66 p-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Người dùng">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.userId}
                onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value, offset: 0 }))}
              >
                <option value="">Tất cả người dùng</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    @{user.username}{user.displayName ? ` · ${user.displayName}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Domain">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.domain}
                onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value, offset: 0 }))}
              >
                <option value="">Tất cả domain</option>
                {domainOptions.map((domain) => (
                  <option key={domain.domain} value={domain.domain}>{domain.domain}</option>
                ))}
              </Select>
            </Field>
            <Field label="Trạng thái">
              <Select className={COMPACT_INPUT_CLASS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, offset: 0 }))}>
                <option value="">Tất cả</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Quyền"
        title="Danh sách quyền"
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{permissions.length} dòng</Badge>
            <CompactPagination
              total={totalPermissions}
              count={permissions.length}
              offset={filters.offset}
              limit={filters.limit}
              onLimitChange={(limit) => setFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            <Button size="sm" icon={ShieldPlus} onClick={() => setCreateModalOpen(true)}>
              Tạo quyền
            </Button>
          </div>
        )}
      >
        {permissions.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_170px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Domain</p>
              <p>Người dùng / trạng thái</p>
              <p className="text-right">Cập nhật</p>
            </div>

            <div className="grid gap-0">
              {permissions.map((permission) => {
                const isActive = selectedPermissionId === permission.id

                return (
                  <button
                    key={permission.id}
                    type="button"
                    onClick={() => setSelectedPermissionId(permission.id)}
                    className={cn(
                      'w-full border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
                      isActive
                        ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
                        : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
                    )}
                  >
                    <div className="space-y-3 lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-[var(--ink)]">{getPermissionScopeLabel(permission)}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Quyền vận hành trên domain</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
                          <Badge tone="success">Vận hành</Badge>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[1rem] border border-[var(--line)] bg-white/72 px-3 py-2.5">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người dùng</p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">@{permission.user.username}</p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--line)] bg-white/72 px-3 py-2.5">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người cấp</p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                            {permission.grantedBy?.username ? `@${permission.grantedBy.username}` : permission.grantedBy?.label || 'Không rõ'}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-[var(--muted)]">
                        Cập nhật {formatDateTime(permission.updatedAt)}
                      </p>
                    </div>

                    <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_170px] lg:items-center lg:gap-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ink)]">{getPermissionScopeLabel(permission)}</p>
                          <Badge tone="success">Vận hành</Badge>
                          <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-[var(--muted)]">Quyền vận hành trên domain</p>
                      </div>

                      <div className="grid gap-2 text-sm text-[var(--ink)]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">@{permission.user.username}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {permission.grantedBy?.username ? `Cấp bởi @${permission.grantedBy.username}` : 'Không có dữ liệu cấp quyền'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
                        <p className="font-medium">{formatDateTime(permission.updatedAt)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có quyền để hiển thị</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Đổi bộ lọc hoặc tạo quyền mới để bắt đầu.
            </p>
          </div>
        )}
      </Panel>

      <PermissionCreateModal
        open={createModalOpen}
        users={userOptions}
        domains={domainOptions}
        form={createForm}
        saving={creatingPermission}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => setCreateModalOpen(false)}
      />

      <PermissionDetailModal
        open={Boolean(selectedPermissionId)}
        permission={selectedPermission}
        loading={loadingDetail}
        deleting={deletingPermission}
        onDelete={handleDelete}
        onClose={() => {
          setSelectedPermissionId(null)
          setSelectedPermission(null)
        }}
      />
    </div>
  )
}
