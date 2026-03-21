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
  updatePermission,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime, getPermissionScopeLabel, normalizeOptional } from '../lib/format.js'
import { Badge, Button, Field, Input, ModalShell, Panel, Select } from '../components/ui.jsx'

const ROLE_OPTIONS = ['viewer', 'operator', 'admin']
const STATUS_OPTIONS = ['active', 'disabled']
const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function emptyPermissionCreateForm() {
  return {
    userId: '',
    domain: '',
    localPart: '',
    role: 'viewer',
    status: 'active',
  }
}

function PermissionCreateModal({ open, users, domains, form, saving, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Create permission"
      title="Cấp quyền mới"
      description="Tạo permission theo domain hoặc mailbox bằng username hoặc user ID."
      tone="ocean"
      size="lg"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="User">
          <Select value={form.userId} onChange={(event) => onChange((current) => ({ ...current, userId: event.target.value }))}>
            <option value="">Chọn user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                @{user.username}{user.displayName ? ` · ${user.displayName}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Domain">
          <Select value={form.domain} onChange={(event) => onChange((current) => ({ ...current, domain: event.target.value }))}>
            <option value="">Chọn domain</option>
            {domains.map((domain) => (
              <option key={domain.domain} value={domain.domain}>{domain.domain}</option>
            ))}
          </Select>
        </Field>
        <Field label="Local part" hint="Để trống cho domain-level">
          <Input value={form.localPart} onChange={(event) => onChange((current) => ({ ...current, localPart: event.target.value }))} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(event) => onChange((current) => ({ ...current, role: event.target.value }))}>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={ShieldPlus} loading={saving}>Tạo permission</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

function PermissionDetailModal({
  open,
  permission,
  form,
  loading,
  saving,
  deleting,
  onChange,
  onSubmit,
  onDelete,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Permission detail"
      title={permission ? getPermissionScopeLabel(permission) : 'Chi tiết permission'}
      description="Theo dõi scope đang cấp cho user nào, ai đã cấp và chỉnh role/status ngay trong modal."
      tone="sage"
      size="lg"
      action={loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {permission ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">User</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">@{permission.user.username}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Granted by</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{permission.grantedBy?.username || permission.grantedBy?.label || 'N/A'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Created</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(permission.createdAt)}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Updated</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(permission.updatedAt)}</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Role">
              <Select value={form.role} onChange={(event) => onChange((current) => ({ ...current, role: event.target.value }))}>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Badge tone={permission.role === 'admin' ? 'accent' : permission.role === 'operator' ? 'success' : 'neutral'}>
                {permission.role}
              </Badge>
              <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>Lưu permission</Button>
              <Button type="button" variant="danger" icon={Trash2} loading={deleting} onClick={onDelete}>Xóa permission</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải chi tiết permission...
        </div>
      )}
    </ModalShell>
  )
}

export default function PermissionsView({ token }) {
  const [filters, setFilters] = useState({
    userId: '',
    domain: '',
    localPart: '',
    role: '',
    status: '',
  })
  const [userOptions, setUserOptions] = useState([])
  const [domainOptions, setDomainOptions] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [selectedPermissionId, setSelectedPermissionId] = useState(null)
  const [selectedPermission, setSelectedPermission] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingPermission, setCreatingPermission] = useState(false)
  const [deletingPermission, setDeletingPermission] = useState(false)
  const [createForm, setCreateForm] = useState(emptyPermissionCreateForm())
  const [editForm, setEditForm] = useState({
    role: 'viewer',
    status: 'active',
  })
  const [savingPermission, setSavingPermission] = useState(false)

  async function loadOptions({ showError = true } = {}) {
    try {
      const [usersResponse, domainsResponse] = await Promise.all([
        listUsers(token),
        listDomains(token),
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
      setPermissions(response.permissions)

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
      setEditForm({
        role: response.permission.role,
        status: response.permission.status,
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
    void loadOptions({ showError: false })
    void loadPermissions(null, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.userId, filters.domain, filters.localPart, filters.role, filters.status])

  useEffect(() => {
    if (!selectedPermissionId) {
      setSelectedPermission(null)
      return
    }

    void loadPermissionDetail(selectedPermissionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPermissionId, token])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadPermissions(selectedPermissionId, filters, {
        showLoading: false,
        showError: false,
      })

      void loadOptions({ showError: false })

      if (selectedPermissionId) {
        void loadPermissionDetail(selectedPermissionId, {
          showLoading: false,
          showError: false,
        })
      }
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPermissionId, token, filters.userId, filters.domain, filters.localPart, filters.role, filters.status])

  async function handleCreate(event) {
    event.preventDefault()
    setCreatingPermission(true)

    try {
      const response = await createPermission(token, {
        ...createForm,
        userId: normalizeOptional(createForm.userId),
        localPart: normalizeOptional(createForm.localPart),
      })
      toast.success('Đã tạo permission')
      setCreateForm(emptyPermissionCreateForm())
      setCreateModalOpen(false)
      setSelectedPermissionId(response.permission.id)
      await loadPermissions(response.permission.id, filters, { showLoading: false, showError: false })
      await loadPermissionDetail(response.permission.id, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setCreatingPermission(false)
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()

    if (!selectedPermissionId) {
      return
    }

    setSavingPermission(true)

    try {
      await updatePermission(token, selectedPermissionId, editForm)
      toast.success('Đã cập nhật permission')
      await loadPermissions(selectedPermissionId, filters, { showLoading: false, showError: false })
      await loadPermissionDetail(selectedPermissionId, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setSavingPermission(false)
    }
  }

  async function handleDelete() {
    if (!selectedPermissionId) {
      return
    }

    setDeletingPermission(true)

    try {
      await deletePermission(token, selectedPermissionId)
      toast.success('Đã xóa permission')
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
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Permissions toolbar</p>
              <Badge tone="accent">Auto refresh 10s</Badge>
              <Badge tone="neutral">{permissions.length} permissions</Badge>
              {loadingPermissions ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.4rem] border border-[var(--line)] bg-white/66 p-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="User">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.userId}
                onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
              >
                <option value="">All users</option>
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
                onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value }))}
              >
                <option value="">All domains</option>
                {domainOptions.map((domain) => (
                  <option key={domain.domain} value={domain.domain}>{domain.domain}</option>
                ))}
              </Select>
            </Field>
            <Field label="Local part">
              <Input
                className={COMPACT_INPUT_CLASS}
                value={filters.localPart}
                onChange={(event) => setFilters((current) => ({ ...current, localPart: event.target.value }))}
              />
            </Field>
            <Field label="Role">
              <Select className={COMPACT_INPUT_CLASS} value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}>
                <option value="">All</option>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select className={COMPACT_INPUT_CLASS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Permissions"
        title="Danh sách quyền"
        description="List permission là phần nhìn chính. Chọn một dòng để mở scope detail và chỉnh quyền trong modal."
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{permissions.length} rows</Badge>
            <Button size="sm" icon={ShieldPlus} onClick={() => setCreateModalOpen(true)}>
              Tạo permission
            </Button>
          </div>
        )}
      >
        {permissions.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_180px_170px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Scope</p>
              <p>User / trạng thái</p>
              <p>Role</p>
              <p className="text-right">Updated</p>
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
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {permission.localPart ? `Mailbox ${permission.localPart}@${permission.domain}` : `Domain ${permission.domain}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
                          <Badge tone={permission.role === 'admin' ? 'accent' : permission.role === 'operator' ? 'success' : 'neutral'}>
                            {permission.role}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[1rem] border border-[var(--line)] bg-white/72 px-3 py-2.5">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">User</p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">@{permission.user.username}</p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--line)] bg-white/72 px-3 py-2.5">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Granted</p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                            {permission.grantedBy?.username ? `@${permission.grantedBy.username}` : permission.grantedBy?.label || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-[var(--muted)]">
                        Updated {formatDateTime(permission.updatedAt)}
                      </p>
                    </div>

                    <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_180px_170px] lg:items-center lg:gap-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ink)]">{getPermissionScopeLabel(permission)}</p>
                          <Badge tone={permission.status === 'active' ? 'success' : 'warning'}>{permission.status}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-[var(--muted)]">
                          {permission.localPart ? `Mailbox ${permission.localPart}@${permission.domain}` : `Domain ${permission.domain}`}
                        </p>
                      </div>

                      <div className="grid gap-2 text-sm text-[var(--ink)]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">@{permission.user.username}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {permission.grantedBy?.username ? `Granted by @${permission.grantedBy.username}` : 'No grant metadata'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                        <Badge tone={permission.role === 'admin' ? 'accent' : permission.role === 'operator' ? 'success' : 'neutral'}>
                          {permission.role}
                        </Badge>
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
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có permission để hiển thị</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Đổi filter hoặc tạo permission mới để bắt đầu.
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
        form={editForm}
        loading={loadingDetail}
        saving={savingPermission}
        deleting={deletingPermission}
        onChange={setEditForm}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        onClose={() => {
          setSelectedPermissionId(null)
          setSelectedPermission(null)
        }}
      />
    </div>
  )
}
