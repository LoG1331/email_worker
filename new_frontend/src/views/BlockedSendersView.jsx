import { useEffect, useState } from 'react'
import { Ban, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createBlockedSender,
  deleteBlockedSender,
  getBlockedSender,
  listBlockedSenders,
  listDomains,
  updateBlockedSender,
} from '../lib/api.js'
import { cn, findIssueMessage, formatApiError, formatDateTime, normalizeOptional, truncate } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { AutoRefreshButton, Badge, Button, CompactPagination, Field, FormError, Input, ModalShell, Panel, Select, TextArea } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const STATUS_OPTIONS = ['active', 'disabled']
const PATTERN_TYPE_OPTIONS = [
  { value: '', label: 'Tự nhận diện' },
  { value: 'email', label: 'Email cụ thể' },
  { value: 'domain', label: 'Cả domain' },
]
const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'
const CREATE_HANDLED_FIELDS = ['pattern', 'patternType', 'domain', 'status', 'reason']

function emptyBlockForm() {
  return {
    pattern: '',
    patternType: '',
    domain: '',
    reason: '',
    status: 'active',
  }
}

function patternTypeLabel(patternType) {
  return patternType === 'domain' ? 'Domain gửi' : 'Email gửi'
}

function BlockCreateModal({ open, form, domains, saving, error, onChange, onSubmit, onClose }) {
  const patternError = findIssueMessage(error, 'pattern')

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Chặn thư"
      title="Chặn người gửi mới"
      tone="ember"
      size="lg"
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <FormError error={error} handledFields={CREATE_HANDLED_FIELDS} className="md:col-span-2" />
        <Field label="Người gửi" hint="spam@abc.com hoặc abc.com" error={patternError}>
          <Input
            className={COMPACT_INPUT_CLASS}
            value={form.pattern}
            invalid={Boolean(patternError)}
            onChange={(event) => onChange((current) => ({ ...current, pattern: event.target.value }))}
            placeholder="spam@example.com"
          />
        </Field>
        <Field
          label="Kiểu chặn"
          hint="Chặn domain gồm cả subdomain"
          error={findIssueMessage(error, 'patternType')}
        >
          <Select
            className={COMPACT_INPUT_CLASS}
            value={form.patternType}
            onChange={(event) => onChange((current) => ({ ...current, patternType: event.target.value }))}
          >
            {PATTERN_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Phạm vi"
          hint="Bỏ trống để chặn toàn hệ thống"
          error={findIssueMessage(error, 'domain')}
        >
          <Select
            className={COMPACT_INPUT_CLASS}
            value={form.domain}
            invalid={Boolean(findIssueMessage(error, 'domain'))}
            onChange={(event) => onChange((current) => ({ ...current, domain: event.target.value }))}
          >
            <option value="">Toàn hệ thống</option>
            {domains.map((domain) => (
              <option key={domain.domain} value={domain.domain}>Chỉ domain nhận {domain.domain}</option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái" error={findIssueMessage(error, 'status')}>
          <Select
            className={COMPACT_INPUT_CLASS}
            value={form.status}
            onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}
          >
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Lý do" className="md:col-span-2" error={findIssueMessage(error, 'reason')}>
          <TextArea
            rows={3}
            value={form.reason}
            onChange={(event) => onChange((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Spam quảng cáo"
          />
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" icon={Ban} loading={saving}>Chặn người gửi</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

function BlockDetailModal({
  open,
  blockedSender,
  loading,
  saving,
  deleting,
  error,
  onToggleStatus,
  onDelete,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Chặn thư"
      title={blockedSender ? blockedSender.pattern : 'Chi tiết chặn'}
      tone="slate"
      size="lg"
      action={blockedSender ? (
        <div className="flex flex-wrap items-center gap-2">
          {loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          <Badge tone={blockedSender.status === 'active' ? 'danger' : 'neutral'}>{blockedSender.status}</Badge>
          <Badge tone="accent">{patternTypeLabel(blockedSender.patternType)}</Badge>
        </div>
      ) : loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
    >
      {blockedSender ? (
        <div className="space-y-5">
          <FormError error={error} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Phạm vi</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{blockedSender.domain || 'Toàn hệ thống'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Số thư đã chặn</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{blockedSender.matchCount}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Chặn gần nhất</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
                {blockedSender.lastMatchedAt ? formatDateTime(blockedSender.lastMatchedAt) : 'Chưa có'}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người tạo</p>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
                {blockedSender.createdBy?.username ? `@${blockedSender.createdBy.username}` : blockedSender.createdBy?.label || 'Không rõ'}
              </p>
            </div>
          </div>

          <section className="rounded-[1.4rem] border border-[var(--line)] bg-white/82 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Lý do</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{blockedSender.reason || 'Không ghi lý do'}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
              <Badge tone="neutral">Tạo {formatDateTime(blockedSender.createdAt)}</Badge>
              <Badge tone="neutral">Cập nhật {formatDateTime(blockedSender.updatedAt)}</Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" icon={ShieldOff} loading={saving} onClick={onToggleStatus}>
                {blockedSender.status === 'active' ? 'Tạm tắt chặn' : 'Bật lại chặn'}
              </Button>
              <Button type="button" variant="danger" icon={Trash2} loading={deleting} onClick={onDelete}>Xóa quy tắc</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
          Đang tải chi tiết quy tắc...
        </div>
      )}
    </ModalShell>
  )
}

export default function BlockedSendersView({ token }) {
  const [filters, setFilters] = useState({
    q: '',
    patternType: '',
    status: '',
    scope: '',
    limit: 50,
    offset: 0,
  })
  const [searchDraft, setSearchDraft] = useState('')
  const [blockedSenders, setBlockedSenders] = useState([])
  const [totalBlockedSenders, setTotalBlockedSenders] = useState(0)
  const [domainOptions, setDomainOptions] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedBlockedSender, setSelectedBlockedSender] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [createForm, setCreateForm] = useState(emptyBlockForm())
  const [createError, setCreateError] = useState(null)
  const [detailError, setDetailError] = useState(null)

  async function loadDomainOptions({ showError = true } = {}) {
    try {
      const response = await listDomains(token, { limit: 200, offset: 0 })
      setDomainOptions(response.domains)
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    }
  }

  async function loadBlockedSenders(
    preferredId = selectedId,
    activeFilters = filters,
    { showLoading = true, showError = true } = {},
  ) {
    if (showLoading) {
      setLoadingList(true)
    }

    try {
      const response = await listBlockedSenders(token, activeFilters)
      if (!response.blockedSenders.length && activeFilters.offset > 0 && response.total <= activeFilters.offset) {
        setFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setBlockedSenders(response.blockedSenders)
      setTotalBlockedSenders(response.total)

      if (preferredId && !response.blockedSenders.some((item) => item.id === preferredId)) {
        setSelectedId(null)
        setSelectedBlockedSender(null)
      }

      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoadingList(false)
    }
  }

  async function loadDetail(blockedSenderId = selectedId, { showLoading = true, showError = true } = {}) {
    if (!blockedSenderId) {
      return null
    }

    if (showLoading) {
      setLoadingDetail(true)
    }

    try {
      const response = await getBlockedSender(token, blockedSenderId)
      setSelectedBlockedSender(response.blockedSender)
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
    void loadDomainOptions({ showError: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void loadBlockedSenders(null, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.q, filters.patternType, filters.status, filters.scope, filters.limit, filters.offset])

  useEffect(() => {
    if (!selectedId) {
      setSelectedBlockedSender(null)
      return
    }

    void loadDetail(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadBlockedSenders(selectedId, filters, {
      showLoading: false,
      showError: false,
    })

    if (selectedId) {
      await loadDetail(selectedId, {
        showLoading: false,
        showError: false,
      })
    }
  }, 15000)

  async function handleCreate(event) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const response = await createBlockedSender(token, {
        pattern: createForm.pattern.trim(),
        patternType: normalizeOptional(createForm.patternType) ?? undefined,
        domain: normalizeOptional(createForm.domain),
        reason: createForm.reason,
        status: createForm.status,
      })
      toast.success('Đã chặn người gửi')
      setCreateForm(emptyBlockForm())
      setCreateModalOpen(false)
      const nextFilters = { ...filters, offset: 0 }
      setFilters(nextFilters)
      setSelectedId(response.blockedSender.id)
      await loadBlockedSenders(response.blockedSender.id, nextFilters, { showLoading: false, showError: false })
    } catch (error) {
      setCreateError(error)
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleStatus() {
    if (!selectedBlockedSender) {
      return
    }

    setSavingDetail(true)
    setDetailError(null)

    try {
      const nextStatus = selectedBlockedSender.status === 'active' ? 'disabled' : 'active'
      const response = await updateBlockedSender(token, selectedBlockedSender.id, { status: nextStatus })
      setSelectedBlockedSender(response.blockedSender)
      toast.success(nextStatus === 'active' ? 'Đã bật lại chặn' : 'Đã tạm tắt chặn')
      await loadBlockedSenders(selectedBlockedSender.id, filters, { showLoading: false, showError: false })
    } catch (error) {
      setDetailError(error)
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleDelete() {
    if (!selectedId) {
      return
    }

    setDeleting(true)
    setDetailError(null)

    try {
      await deleteBlockedSender(token, selectedId)
      toast.success('Đã xóa quy tắc chặn')
      setSelectedId(null)
      setSelectedBlockedSender(null)
      await loadBlockedSenders(null, filters, { showLoading: false, showError: false })
    } catch (error) {
      setDetailError(error)
    } finally {
      setDeleting(false)
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    setFilters((current) => ({ ...current, q: searchDraft.trim(), offset: 0 }))
  }

  return (
    <div className="space-y-5">
      <Panel tone="ember" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Chặn thư</p>
            <AutoRefreshButton onClick={refreshNow} />
            <Badge tone="neutral">{blockedSenders.length} / {totalBlockedSenders} quy tắc</Badge>
            {loadingList ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
          </div>

          <div className="grid gap-3 rounded-[1.4rem] border border-[var(--line)] bg-white/66 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <form onSubmit={handleSearchSubmit}>
              <Field label="Tìm kiếm" hint="Enter để tìm">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="spam@example.com"
                />
              </Field>
            </form>
            <Field label="Kiểu chặn">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.patternType}
                onChange={(event) => setFilters((current) => ({ ...current, patternType: event.target.value, offset: 0 }))}
              >
                <option value="">Tất cả</option>
                <option value="email">Email cụ thể</option>
                <option value="domain">Cả domain</option>
              </Select>
            </Field>
            <Field label="Phạm vi">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.scope}
                onChange={(event) => setFilters((current) => ({ ...current, scope: event.target.value, offset: 0 }))}
              >
                <option value="">Tất cả</option>
                <option value="global">Toàn hệ thống</option>
                <option value="domain">Theo domain nhận</option>
              </Select>
            </Field>
            <Field label="Trạng thái">
              <Select
                className={COMPACT_INPUT_CLASS}
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, offset: 0 }))}
              >
                <option value="">Tất cả</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Chặn thư"
        title="Danh sách chặn người gửi"
        tone="slate"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{blockedSenders.length} dòng</Badge>
            <CompactPagination
              total={totalBlockedSenders}
              count={blockedSenders.length}
              offset={filters.offset}
              limit={filters.limit}
              onLimitChange={(limit) => setFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            <Button
              size="sm"
              icon={Ban}
              onClick={() => {
                setCreateError(null)
                setCreateForm(emptyBlockForm())
                setCreateModalOpen(true)
              }}
            >
              Chặn người gửi
            </Button>
          </div>
        )}
      >
        {blockedSenders.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_220px_180px_170px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Người gửi</p>
              <p>Phạm vi / kiểu</p>
              <p>Đã chặn</p>
              <p className="text-right">Cập nhật</p>
            </div>

            <div className="grid gap-0">
              {blockedSenders.map((item) => {
                const isActive = selectedId === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'grid w-full gap-4 border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
                      'lg:grid-cols-[minmax(0,1.2fr)_220px_180px_170px] lg:items-center',
                      isActive
                        ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
                        : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Ban className="h-4 w-4 text-[var(--danger)]" />
                        <p className="truncate font-semibold text-[var(--ink)]">
                          {item.patternType === 'domain' ? `*@${item.pattern}` : item.pattern}
                        </p>
                        <Badge tone={item.status === 'active' ? 'danger' : 'neutral'}>{item.status}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">{truncate(item.reason || 'Không ghi lý do', 110)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{patternTypeLabel(item.patternType)}</Badge>
                      <Badge tone="neutral">{item.domain || 'Toàn hệ thống'}</Badge>
                    </div>

                    <div className="grid gap-1 text-sm text-[var(--ink)]">
                      <p className="font-semibold">{item.matchCount} thư</p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.lastMatchedAt ? formatDateTime(item.lastMatchedAt) : 'Chưa chặn thư nào'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm text-[var(--muted)] lg:justify-end">
                      <p className="font-medium">{formatDateTime(item.updatedAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa chặn người gửi nào</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Thêm địa chỉ email hoặc domain để hệ thống bỏ qua thư từ họ ngay khi nhận.
            </p>
          </div>
        )}
      </Panel>

      <BlockCreateModal
        open={createModalOpen}
        form={createForm}
        domains={domainOptions}
        saving={creating}
        error={createError}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => {
          setCreateModalOpen(false)
          setCreateError(null)
        }}
      />

      <BlockDetailModal
        open={Boolean(selectedId)}
        blockedSender={selectedBlockedSender}
        loading={loadingDetail}
        saving={savingDetail}
        deleting={deleting}
        error={detailError}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onClose={() => {
          setSelectedId(null)
          setSelectedBlockedSender(null)
          setDetailError(null)
        }}
      />
    </div>
  )
}
