import { useEffect, useState } from 'react'
import { Globe2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createDomain,
  deleteDomain,
  getDomain,
  listDomains,
} from '../lib/api.js'
import { cn, findIssueMessage, formatApiError, formatDateTime, truncate } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { AutoRefreshButton, Badge, Button, Checkbox, CompactPagination, Field, FormError, Input, ModalShell, Panel, Select, TextArea } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const STATUS_OPTIONS = ['active', 'disabled']
const CREATE_HANDLED_FIELDS = ['domain', 'description', 'status', 'inboundEnabled', 'isDefault']

function emptyDomainForm() {
  return {
    domain: '',
    description: '',
    status: 'active',
    inboundEnabled: true,
    isDefault: false,
  }
}

function DomainCreateModal({ open, form, saving, error, onChange, onSubmit, onClose }) {
  const domainError = findIssueMessage(error, 'domain')

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Domain"
      title="Tạo domain mới"
      tone="sand"
      size="md"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <FormError error={error} handledFields={CREATE_HANDLED_FIELDS} className="md:col-span-2" />
        <Field label="Domain" error={domainError}>
          <Input invalid={Boolean(domainError)} value={form.domain} onChange={(event) => onChange((current) => ({ ...current, domain: event.target.value }))} placeholder="example.com" />
        </Field>
        <Field label="Trạng thái" error={findIssueMessage(error, 'status')}>
          <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Mô tả" className="md:col-span-2" error={findIssueMessage(error, 'description')}>
          <TextArea rows={3} value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-4">
          <Checkbox label="Bật nhận thư" checked={form.inboundEnabled} onChange={(event) => onChange((current) => ({ ...current, inboundEnabled: event.target.checked }))} />
          <Checkbox label="Domain mặc định" checked={form.isDefault} onChange={(event) => onChange((current) => ({ ...current, isDefault: event.target.checked }))} />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={Plus} loading={saving}>Tạo domain</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

function DomainDetailModal({
  open,
  domain,
  loading,
  canDelete,
  deletingDomain,
  error,
  onDeleteDomain,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Domain"
      title={domain ? domain.domain : 'Chi tiết domain'}
      tone="slate"
      size="xl"
      action={domain ? (
        <div className="flex flex-wrap items-center gap-2">
          {loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          <Badge tone={domain.status === 'active' ? 'success' : 'warning'}>{domain.status}</Badge>
          <Badge tone={domain.inboundEnabled ? 'accent' : 'warning'}>{domain.inboundEnabled ? 'Nhận thư bật' : 'Nhận thư tắt'}</Badge>
          {domain.isDefault ? <Badge tone="accent">Mặc định</Badge> : null}
          <Badge tone="neutral">{domain.counts.permissionCount} quyền</Badge>
        </div>
      ) : loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {domain ? (
        <div className="space-y-4">
          <FormError error={error} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[1.3rem] border border-[var(--line)] bg-white/74 px-4 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Mô tả</p>
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{domain.description || 'Không có mô tả'}</p>
            </div>
            <div className="basis-28">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Email</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{domain.counts.emails}</p>
            </div>
            <div className="basis-40">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Tạo lúc</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(domain.createdAt)}</p>
            </div>
            <div className="basis-40">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Cập nhật</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(domain.updatedAt)}</p>
            </div>
          </div>

          <section className="rounded-[1.45rem] border border-[var(--line)] bg-white/82 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Chi tiết cấu hình</p>
              <Badge tone="neutral">{domain.domain}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="rounded-[1rem] border border-[var(--line)] bg-white/76 px-4 py-3 md:row-span-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Mô tả</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{domain.description || 'Không có mô tả'}</p>
              </div>
              <div className="rounded-[1rem] border border-[var(--line)] bg-white/76 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Trạng thái</p>
                <div className="mt-2">
                  <Badge tone={domain.status === 'active' ? 'success' : 'warning'}>{domain.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 rounded-[1rem] border border-[var(--line)] bg-white/76 px-4 py-3">
                <Badge tone={domain.inboundEnabled ? 'accent' : 'warning'}>{domain.inboundEnabled ? 'Nhận thư bật' : 'Nhận thư tắt'}</Badge>
                {domain.isDefault ? <Badge tone="accent">Domain mặc định</Badge> : <Badge tone="neutral">Không mặc định</Badge>}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {canDelete ? <Button type="button" size="sm" variant="danger" icon={Trash2} loading={deletingDomain} onClick={onDeleteDomain}>Xóa domain</Button> : null}
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải thông tin domain...
        </div>
      )}
    </ModalShell>
  )
}

export default function DomainsView({ token, account, accessibleDomains }) {
  const [domains, setDomains] = useState([])
  const [totalDomains, setTotalDomains] = useState(0)
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [selectedDomainName, setSelectedDomainName] = useState(null)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingDomain, setCreatingDomain] = useState(false)
  const [deletingDomain, setDeletingDomain] = useState(false)
  const [createForm, setCreateForm] = useState(emptyDomainForm())
  const [createError, setCreateError] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [filters, setFilters] = useState({
    limit: 50,
    offset: 0,
  })

  async function loadDomains(
    preferredDomain = selectedDomainName,
    query = filters,
    { showLoading = true, showError = true } = {},
  ) {
    if (showLoading) {
      setLoadingDomains(true)
    }

    try {
      const response = await listDomains(token, query)
      if (!response.domains.length && query.offset > 0 && response.total <= query.offset) {
        setFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setDomains(response.domains)
      setTotalDomains(response.total)

      if (!response.domains.length) {
        setSelectedDomainName(null)
        setSelectedDomain(null)
        return response
      }

      if (preferredDomain && !response.domains.some((domain) => domain.domain === preferredDomain)) {
        setSelectedDomainName(null)
        setSelectedDomain(null)
      }

      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingDomains(false)
    }
  }

  async function loadDomainDetail(domainName = selectedDomainName, { showLoading = true, showError = true } = {}) {
    if (!domainName) {
      return null
    }

    if (showLoading) {
      setLoadingDetail(true)
    }

    try {
      const domainResponse = await getDomain(token, domainName)
      setSelectedDomain(domainResponse.domain)
      return domainResponse
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
    void loadDomains(null, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.limit, filters.offset, token])

  useEffect(() => {
    if (!selectedDomainName) {
      setSelectedDomain(null)
      return
    }

    void loadDomainDetail(selectedDomainName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomainName, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadDomains(selectedDomainName, filters, {
      showLoading: false,
      showError: false,
    })

    if (selectedDomainName) {
      await loadDomainDetail(selectedDomainName, {
        showLoading: false,
        showError: false,
      })
    }
  }, 10000)

  async function handleCreateDomain(event) {
    event.preventDefault()
    setCreatingDomain(true)
    setCreateError(null)

    try {
      const response = await createDomain(token, createForm)
      toast.success('Đã tạo domain')
      setCreateForm(emptyDomainForm())
      setCreateModalOpen(false)
      setSelectedDomainName(response.domain.domain)
      const nextFilters = {
        ...filters,
        offset: 0,
      }
      setFilters(nextFilters)
      await loadDomains(response.domain.domain, nextFilters, { showLoading: false, showError: false })
      await loadDomainDetail(response.domain.domain, { showLoading: false, showError: false })
    } catch (error) {
      setCreateError(error)
    } finally {
      setCreatingDomain(false)
    }
  }

  async function handleDeleteDomain() {
    if (!selectedDomainName) {
      return
    }

    setDeletingDomain(true)
    setDetailError(null)

    try {
      await deleteDomain(token, selectedDomainName)
      toast.success('Đã xóa domain')
      setSelectedDomainName(null)
      setSelectedDomain(null)
      await loadDomains(null, filters, { showLoading: false, showError: false })
    } catch (error) {
      setDetailError(error)
    } finally {
      setDeletingDomain(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Domain</p>
            <AutoRefreshButton onClick={refreshNow} />
            <Badge tone="neutral">{accessibleDomains.length} domain được cấp</Badge>
            <Badge tone="neutral">{domains.length} / {totalDomains} domain</Badge>
            {loadingDomains ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Domain"
        title="Danh sách domain"
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{domains.length} dòng</Badge>
            <CompactPagination
              total={totalDomains}
              count={domains.length}
              offset={filters.offset}
              limit={filters.limit}
              onLimitChange={(limit) => setFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            {account.isAdmin ? (
              <Button
                size="sm"
                icon={Plus}
                onClick={() => {
                  setCreateError(null)
                  setCreateForm(emptyDomainForm())
                  setCreateModalOpen(true)
                }}
              >
                Tạo domain
              </Button>
            ) : null}
          </div>
        )}
      >
        {domains.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.15fr)_220px_220px_170px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Domain</p>
              <p>Nhận thư / trạng thái</p>
              <p>Thông số</p>
              <p className="text-right">Cập nhật</p>
            </div>

            <div className="grid gap-0">
              {domains.map((domain) => {
                const isActive = selectedDomainName === domain.domain

                return (
                  <button
                    key={domain.domain}
                    type="button"
                    onClick={() => setSelectedDomainName(domain.domain)}
                    className={cn(
                      'grid w-full gap-4 border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
                      'lg:grid-cols-[minmax(0,1.15fr)_220px_220px_170px] lg:items-center',
                      isActive
                        ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
                        : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Globe2 className="h-4 w-4 text-[var(--accent)]" />
                        <p className="font-semibold text-[var(--ink)]">{domain.domain}</p>
                        <Badge tone={domain.status === 'active' ? 'success' : 'warning'}>{domain.status}</Badge>
                        {domain.isDefault ? <Badge tone="accent">Mặc định</Badge> : null}
                      </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">{truncate(domain.description || 'Không có mô tả', 110)}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-[var(--ink)]">
                      <Badge tone={domain.inboundEnabled ? 'accent' : 'warning'}>{domain.inboundEnabled ? 'Nhận thư bật' : 'Nhận thư tắt'}</Badge>
                    </div>

                    <div className="grid gap-2 text-sm text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{domain.counts.emails} email</Badge>
                        <Badge tone="neutral">{domain.counts.permissionCount} quyền</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm text-[var(--muted)] lg:justify-end">
                      <p className="font-medium">{formatDateTime(domain.updatedAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Không có domain hiển thị</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Có thể tài khoản này chỉ có quyền ở mức hộp thư hoặc chưa được cấp quyền theo domain.
            </p>
          </div>
        )}
      </Panel>

      {account.isAdmin ? (
        <DomainCreateModal
          open={createModalOpen}
          form={createForm}
          saving={creatingDomain}
          error={createError}
          onChange={setCreateForm}
          onSubmit={handleCreateDomain}
          onClose={() => {
            setCreateModalOpen(false)
            setCreateError(null)
          }}
        />
      ) : null}

      <DomainDetailModal
        open={Boolean(selectedDomainName)}
        domain={selectedDomain}
        loading={loadingDetail}
        canDelete={account.isAdmin}
        deletingDomain={deletingDomain}
        error={detailError}
        onDeleteDomain={handleDeleteDomain}
        onClose={() => {
          setSelectedDomainName(null)
          setSelectedDomain(null)
          setDetailError(null)
        }}
      />
    </div>
  )
}
