import { useEffect, useState } from 'react'
import { Globe2, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createDomain,
  getDomain,
  listDomains,
  updateDomain,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime, truncate } from '../lib/format.js'
import { Badge, Button, Checkbox, Field, Input, ModalShell, Panel, Select, TextArea } from '../components/ui.jsx'

const STATUS_OPTIONS = ['active', 'disabled']
const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function emptyDomainForm() {
  return {
    domain: '',
    description: '',
    status: 'active',
    inboundEnabled: true,
    isDefault: false,
  }
}

function DomainCreateModal({ open, form, saving, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Create domain"
      title="Tạo hoặc upsert domain"
      description="Thêm domain mới, bật inbound và đánh dấu default domain nếu cần."
      tone="sand"
      size="md"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Domain">
          <Input value={form.domain} onChange={(event) => onChange((current) => ({ ...current, domain: event.target.value }))} placeholder="example.com" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Description" className="md:col-span-2">
          <TextArea rows={3} value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-4">
          <Checkbox label="Inbound enabled" checked={form.inboundEnabled} onChange={(event) => onChange((current) => ({ ...current, inboundEnabled: event.target.checked }))} />
          <Checkbox label="Default domain" checked={form.isDefault} onChange={(event) => onChange((current) => ({ ...current, isDefault: event.target.checked }))} />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={Plus} loading={saving}>Lưu domain</Button>
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
  editForm,
  savingDomain,
  onChangeDomain,
  onSubmitDomain,
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
          <Badge tone={domain.inboundEnabled ? 'accent' : 'warning'}>{domain.inboundEnabled ? 'Inbound' : 'Inbound off'}</Badge>
          {domain.isDefault ? <Badge tone="accent">Default</Badge> : null}
          <Badge tone="neutral">{domain.counts.domainPermissions + domain.counts.mailboxPermissions} rights</Badge>
        </div>
      ) : loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {domain ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[1.3rem] border border-[var(--line)] bg-white/74 px-4 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Description</p>
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{domain.description || 'Không có mô tả'}</p>
            </div>
            <div className="basis-28">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Emails</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{domain.counts.emails}</p>
            </div>
            <div className="basis-40">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Created</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(domain.createdAt)}</p>
            </div>
            <div className="basis-40">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Updated</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(domain.updatedAt)}</p>
            </div>
          </div>

          <form className="rounded-[1.45rem] border border-[var(--line)] bg-white/82 p-4 sm:p-5" onSubmit={onSubmitDomain}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Cấu hình</p>
              <Badge tone="neutral">{domain.domain}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Description" className="md:row-span-2">
                <TextArea className={COMPACT_INPUT_CLASS} rows={4} value={editForm.description} onChange={(event) => onChangeDomain((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Status">
                <Select className={COMPACT_INPUT_CLASS} value={editForm.status} onChange={(event) => onChangeDomain((current) => ({ ...current, status: event.target.value }))}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </Select>
              </Field>
              <div className="flex flex-wrap gap-4 rounded-[1rem] border border-[var(--line)] bg-white/76 px-4 py-3">
                <Checkbox label="Inbound" checked={editForm.inboundEnabled} onChange={(event) => onChangeDomain((current) => ({ ...current, inboundEnabled: event.target.checked }))} />
                <Checkbox label="Default" checked={editForm.isDefault} onChange={(event) => onChangeDomain((current) => ({ ...current, isDefault: event.target.checked }))} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={savingDomain}>Lưu</Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải chi tiết domain...
        </div>
      )}
    </ModalShell>
  )
}

export default function DomainsView({ token, account, accessibleDomains }) {
  const [domains, setDomains] = useState([])
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [selectedDomainName, setSelectedDomainName] = useState(null)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingDomain, setCreatingDomain] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [createForm, setCreateForm] = useState(emptyDomainForm())
  const [editForm, setEditForm] = useState({
    description: '',
    status: 'active',
    inboundEnabled: true,
    isDefault: false,
  })

  async function loadDomains(preferredDomain = selectedDomainName, { showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingDomains(true)
    }

    try {
      const response = await listDomains(token)
      setDomains(response.domains)

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
      setEditForm({
        description: domainResponse.domain.description,
        status: domainResponse.domain.status,
        inboundEnabled: domainResponse.domain.inboundEnabled,
        isDefault: domainResponse.domain.isDefault,
      })

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
    void loadDomains(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!selectedDomainName) {
      setSelectedDomain(null)
      return
    }

    void loadDomainDetail(selectedDomainName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomainName, token])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDomains(selectedDomainName, {
        showLoading: false,
        showError: false,
      })

      if (selectedDomainName) {
        void loadDomainDetail(selectedDomainName, {
          showLoading: false,
          showError: false,
        })
      }
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomainName, token])

  async function handleCreateDomain(event) {
    event.preventDefault()
    setCreatingDomain(true)

    try {
      const response = await createDomain(token, createForm)
      toast.success('Đã lưu domain')
      setCreateForm(emptyDomainForm())
      setCreateModalOpen(false)
      setSelectedDomainName(response.domain.domain)
      await loadDomains(response.domain.domain, { showLoading: false, showError: false })
      await loadDomainDetail(response.domain.domain, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setCreatingDomain(false)
    }
  }

  async function handleUpdateDomain(event) {
    event.preventDefault()

    if (!selectedDomainName) {
      return
    }

    setSavingDomain(true)

    try {
      await updateDomain(token, selectedDomainName, editForm)
      toast.success('Đã cập nhật domain')
      await loadDomains(selectedDomainName, { showLoading: false, showError: false })
      await loadDomainDetail(selectedDomainName, { showLoading: false, showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setSavingDomain(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Domains toolbar</p>
            <Badge tone="accent">Auto refresh 10s</Badge>
            <Badge tone="neutral">accessibleDomains: {accessibleDomains.length}</Badge>
            <Badge tone="neutral">{domains.length} domains</Badge>
            {loadingDomains ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Domains"
        title="Danh sách domain"
        description="List domain là phần nhìn chính. Chọn domain để mở detail, xem email count và số permission đã cấp."
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{domains.length} rows</Badge>
            {account.isAdmin ? (
              <Button size="sm" icon={Plus} onClick={() => setCreateModalOpen(true)}>
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
              <p>Inbound / trạng thái</p>
              <p>Counts</p>
              <p className="text-right">Updated</p>
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
                        {domain.isDefault ? <Badge tone="accent">Default</Badge> : null}
                      </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">{truncate(domain.description || 'Không có mô tả', 110)}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-[var(--ink)]">
                      <Badge tone={domain.inboundEnabled ? 'accent' : 'warning'}>{domain.inboundEnabled ? 'Inbound enabled' : 'Inbound off'}</Badge>
                    </div>

                    <div className="grid gap-2 text-sm text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{domain.counts.emails} emails</Badge>
                        <Badge tone="neutral">{domain.counts.domainPermissions + domain.counts.mailboxPermissions} permissions</Badge>
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
              Có thể account này chỉ có mailbox-level permission hoặc chưa được cấp domain scope.
            </p>
          </div>
        )}
      </Panel>

      {account.isAdmin ? (
        <DomainCreateModal
          open={createModalOpen}
          form={createForm}
          saving={creatingDomain}
          onChange={setCreateForm}
          onSubmit={handleCreateDomain}
          onClose={() => setCreateModalOpen(false)}
        />
      ) : null}

      <DomainDetailModal
        open={Boolean(selectedDomainName)}
        domain={selectedDomain}
        loading={loadingDetail}
        editForm={editForm}
        savingDomain={savingDomain}
        onChangeDomain={setEditForm}
        onSubmitDomain={handleUpdateDomain}
        onClose={() => {
          setSelectedDomainName(null)
          setSelectedDomain(null)
        }}
      />
    </div>
  )
}
