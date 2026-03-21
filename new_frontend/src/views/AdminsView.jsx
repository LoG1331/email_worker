import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Crown, ShieldPlus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { grantAdmin, listAdmins, revokeAdmin } from '../lib/api.js'
import { formatApiError, formatDateTime } from '../lib/format.js'
import DataTable from '../components/DataTable.jsx'
import { Badge, Button, Field, Input, ModalShell, Panel } from '../components/ui.jsx'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function GrantAdminModal({ open, form, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Admin"
      title="Grant admin"
      description="Thêm một user vào bảng admin bằng user ID hoặc username."
      tone="ocean"
      size="md"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field label="User ID" hint="Ưu tiên nếu có">
          <Input className={COMPACT_INPUT_CLASS} value={form.userId} onChange={(event) => onChange((current) => ({ ...current, userId: event.target.value }))} />
        </Field>
        <Field label="Username">
          <Input className={COMPACT_INPUT_CLASS} value={form.username} onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" icon={ShieldPlus}>Grant admin</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

export default function AdminsView({ token }) {
  const [admins, setAdmins] = useState([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [filterText, setFilterText] = useState('')
  const deferredFilterText = useDeferredValue(filterText)
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [grantForm, setGrantForm] = useState({
    userId: '',
    username: '',
  })

  async function loadAdmins({ showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingAdmins(true)
    }

    try {
      const response = await listAdmins(token)
      setAdmins(response.admins)
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    } finally {
      setLoadingAdmins(false)
    }
  }

  useEffect(() => {
    void loadAdmins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadAdmins({
        showLoading: false,
        showError: false,
      })
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const visibleAdmins = useMemo(() => {
    const keyword = deferredFilterText.trim().toLowerCase()
    if (!keyword) {
      return admins
    }

    return admins.filter((admin) =>
      [admin.username, admin.displayName, admin.telegramId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [admins, deferredFilterText])

  async function handleGrant(event) {
    event.preventDefault()

    try {
      await grantAdmin(token, {
        userId: grantForm.userId || undefined,
        username: grantForm.username || undefined,
      })
      toast.success('Đã grant admin')
      setGrantForm({
        userId: '',
        username: '',
      })
      setGrantModalOpen(false)
      await loadAdmins()
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleRevoke(userId) {
    try {
      await revokeAdmin(token, userId)
      toast.success('Đã revoke admin')
      await loadAdmins()
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
          <p className="text-xs text-[var(--muted)]">{admin.displayName || 'Không có display name'}</p>
        </div>
      ),
    },
    {
      key: 'grantedAt',
      label: 'Granted',
      render: (admin) => formatDateTime(admin.grantedAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (admin) => <Badge tone={admin.status === 'active' ? 'success' : 'warning'}>{admin.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
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
          Revoke
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Admins toolbar</p>
            <Badge tone="accent">Auto refresh 10s</Badge>
            <Badge tone="neutral">{admins.length} admins</Badge>
            {loadingAdmins ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>

          <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/68 p-3">
            <Field label="Lọc local theo username / display / telegram">
              <Input
                className={COMPACT_INPUT_CLASS}
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="@admin"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Admins"
        title="Danh sách admin"
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{visibleAdmins.length} hiển thị</Badge>
            <Button size="sm" icon={ShieldPlus} onClick={() => setGrantModalOpen(true)}>
              Grant admin
            </Button>
          </div>
        )}
      >
        <DataTable
          columns={columns}
          rows={visibleAdmins}
          emptyTitle="Chưa có admin"
          emptyDescription="Ít nhất nên có một bootstrap admin ở backend."
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
