import { useDeferredValue, useEffect, useState } from 'react'
import { Crown, ShieldPlus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { grantAdmin, listAdmins, revokeAdmin } from '../lib/api.js'
import { formatApiError, formatDateTime } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import DataTable from '../components/DataTable.jsx'
import { AutoRefreshButton, Badge, Button, CompactPagination, Field, Input, ModalShell, Panel } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function GrantAdminModal({ open, form, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Admin"
      title="Cấp quyền admin"
      description="Thêm một người dùng vào bảng admin bằng user ID hoặc tên đăng nhập."
      tone="ocean"
      size="md"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field label="User ID" hint="Ưu tiên nếu có">
          <Input className={COMPACT_INPUT_CLASS} value={form.userId} onChange={(event) => onChange((current) => ({ ...current, userId: event.target.value }))} />
        </Field>
        <Field label="Tên đăng nhập">
          <Input className={COMPACT_INPUT_CLASS} value={form.username} onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" icon={ShieldPlus}>Cấp admin</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

export default function AdminsView({ token }) {
  const [admins, setAdmins] = useState([])
  const [totalAdmins, setTotalAdmins] = useState(0)
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    limit: 50,
    offset: 0,
  })
  const deferredQuery = useDeferredValue(filters.q)
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [grantForm, setGrantForm] = useState({
    userId: '',
    username: '',
  })

  async function loadAdmins(
    query = {
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    },
    { showLoading = true, showError = true } = {},
  ) {
    if (showLoading) {
      setLoadingAdmins(true)
    }

    try {
      const response = await listAdmins(token, query)
      if (!response.admins.length && query.offset > 0 && response.total <= query.offset) {
        setFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setAdmins(response.admins)
      setTotalAdmins(response.total)
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    } finally {
      setLoadingAdmins(false)
    }
  }

  useEffect(() => {
    void loadAdmins({
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery, filters.limit, filters.offset, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadAdmins({
      q: deferredQuery,
      limit: filters.limit,
      offset: filters.offset,
    }, {
      showLoading: false,
      showError: false,
    })
  }, 10000)

  async function handleGrant(event) {
    event.preventDefault()

    try {
      await grantAdmin(token, {
        userId: grantForm.userId || undefined,
        username: grantForm.username || undefined,
      })
      toast.success('Đã cấp admin')
      setGrantForm({
        userId: '',
        username: '',
      })
      setGrantModalOpen(false)
      setFilters((current) => ({ ...current, offset: 0 }))
      await loadAdmins({
        q: deferredQuery,
        limit: filters.limit,
        offset: 0,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleRevoke(userId) {
    try {
      await revokeAdmin(token, userId)
      toast.success('Đã gỡ admin')
      await loadAdmins({
        q: deferredQuery,
        limit: filters.limit,
        offset: filters.offset,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  const columns = [
    {
      key: 'username',
      label: 'Admin',
      render: (admin) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-[var(--accent)]" />
            <p className="font-semibold text-[var(--ink)]">@{admin.username}</p>
          </div>
          <p className="text-xs text-[var(--muted)]">{admin.displayName || 'Không có tên hiển thị'}</p>
        </div>
      ),
    },
    {
      key: 'grantedAt',
      label: 'Cấp lúc',
      render: (admin) => formatDateTime(admin.grantedAt),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (admin) => <Badge tone={admin.status === 'active' ? 'success' : 'warning'}>{admin.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (admin) => (
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={(event) => {
            event.stopPropagation()
            handleRevoke(admin.id)
          }}
        >
          Gỡ admin
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Admin</p>
            <AutoRefreshButton onClick={refreshNow} />
            <Badge tone="neutral">{admins.length} / {totalAdmins} admin</Badge>
            {loadingAdmins ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>

          <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/68 p-3">
            <Field label="Tìm theo username / tên hiển thị / telegram">
              <Input
                className={COMPACT_INPUT_CLASS}
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, offset: 0 }))}
                placeholder="@admin"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Admin"
        title="Danh sách admin"
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{admins.length} hiển thị</Badge>
            <CompactPagination
              total={totalAdmins}
              count={admins.length}
              offset={filters.offset}
              limit={filters.limit}
              onLimitChange={(limit) => setFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            <Button size="sm" icon={ShieldPlus} onClick={() => setGrantModalOpen(true)}>
              Cấp admin
            </Button>
          </div>
        )}
      >
        <DataTable
          columns={columns}
          rows={admins}
          emptyTitle="Chưa có admin"
          emptyDescription="Nên có ít nhất một admin khởi tạo ở backend."
        />
      </Panel>

      <GrantAdminModal
        open={grantModalOpen}
        form={grantForm}
        onChange={setGrantForm}
        onSubmit={handleGrant}
        onClose={() => setGrantModalOpen(false)}
      />
    </div>
  )
}
