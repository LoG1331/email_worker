import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { deleteEmailById, getEmailById, listSystemEmails } from '../lib/api.js'
import { cn, formatApiError } from '../lib/format.js'
import { EmailDetailModal, EmailFeedList } from '../components/EmailFeed.jsx'
import { AutoRefreshButton, Badge, Button, CursorPagination, Input, Panel } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'
import { useCursorPager } from '../hooks/useCursorPager.js'

const DEFAULT_FILTERS = {
  domain: '',
  address: '',
  limit: 50,
}

const COMPACT_INPUT_CLASS = 'min-h-[42px] rounded-[0.95rem] border-white/70 bg-white/88 px-3.5 py-2 text-sm'

function buildVisibleDomainOptions(emails) {
  const counts = new Map()

  emails.forEach((email) => {
    const domain = String(email?.domain || '').trim().toLowerCase()
    if (!domain) {
      return
    }

    counts.set(domain, (counts.get(domain) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([domain, count]) => ({ domain, count }))
}

export default function AdminEmailsView({ token }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [listing, setListing] = useState({
    loading: false,
    emails: [],
    count: 0,
    hasMore: false,
  })
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [includeRawMime, setIncludeRawMime] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState(false)
  const deferredAddress = useDeferredValue(filters.address)
  const deferredDomain = useDeferredValue(filters.domain)
  const activeFilterCount = Number(Boolean(filters.address)) + Number(Boolean(filters.domain))
  const visibleDomainOptions = useMemo(() => buildVisibleDomainOptions(listing.emails), [listing.emails])
  const emailPager = useCursorPager()

  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmail(null)
      return undefined
    }

    let cancelled = false

    async function loadDetail() {
      setLoadingDetail(true)

      try {
        const response = await getEmailById(token, selectedEmailId, { includeRawMime })
        if (!cancelled) {
          setSelectedEmail(response.email)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(formatApiError(error))
          setSelectedEmail(null)
          setSelectedEmailId(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [includeRawMime, selectedEmailId, token])

  useEffect(() => {
    if (selectedEmailId && !listing.emails.some((email) => email.id === selectedEmailId)) {
      setSelectedEmailId(null)
      setSelectedEmail(null)
    }
  }, [listing.emails, selectedEmailId])

  async function loadList({ showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setListing((current) => ({ ...current, loading: true }))
    }

    try {
      const response = await listSystemEmails(token, {
        address: deferredAddress,
        domain: deferredDomain,
        limit: filters.limit,
        cursor: emailPager.cursor,
      })
      emailPager.sync(response)
      setListing({
        loading: false,
        emails: response.emails,
        count: response.count,
        hasMore: response.hasMore,
      })
      return response
    } catch (error) {
      setListing((current) => ({ ...current, loading: false }))

      if (showError) {
        toast.error(formatApiError(error))
      }

      return null
    }
  }

  useEffect(() => {
    void loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredAddress, deferredDomain, emailPager.cursor, filters.limit, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadList({
      showLoading: false,
      showError: false,
    })
  }, 10000)

  async function handleDeleteEmail() {
    if (!selectedEmailId) {
      return
    }

    setDeletingEmail(true)

    try {
      await deleteEmailById(token, selectedEmailId)
      toast.success('Đã xóa email')
      setSelectedEmail(null)
      setSelectedEmailId(null)
      const response = await loadList({
        showLoading: false,
        showError: false,
      })
      if (!response?.count && emailPager.hasPrev) {
        emailPager.goPrev()
      }
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingEmail(false)
    }
  }

  function handleCloseEmailModal() {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
    emailPager.reset()
  }

  function setDomainFilter(domain) {
    setFilters((current) => ({
      ...current,
      domain,
    }))
    emailPager.reset()
  }

  return (
    <div className="space-y-5">
      <Panel tone="ember" className="p-3.5 sm:p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Điều phối mail admin</p>
              <Badge tone="warning">Toàn hệ thống</Badge>
              <AutoRefreshButton onClick={refreshNow} />
              {listing.loading ? <Badge tone="warning">Đang đồng bộ...</Badge> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{listing.emails.length} mail</Badge>
              <Badge tone={activeFilterCount ? 'warning' : 'success'}>
                {activeFilterCount ? `${activeFilterCount} bộ lọc` : 'Toàn bộ hệ thống'}
              </Badge>
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-[var(--line)] bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(255,245,239,0.9))] p-3 sm:p-3.5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="min-w-0">
                  <span className="sr-only">Địa chỉ nhận</span>
                  <div className="flex min-h-[42px] items-center gap-2 rounded-[0.95rem] border border-white/70 bg-white/88 px-3.5">
                    <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                    <Input
                      className="min-h-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none"
                      value={filters.address}
                      onChange={(event) => {
                        emailPager.reset()
                        setFilters((current) => ({ ...current, address: event.target.value }))
                      }}
                      placeholder="Địa chỉ nhận"
                    />
                  </div>
                </label>

                <label className="min-w-0">
                  <span className="sr-only">Domain</span>
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    value={filters.domain}
                    onChange={(event) => {
                      emailPager.reset()
                      setFilters((current) => ({ ...current, domain: event.target.value }))
                    }}
                    placeholder="Lọc theo domain"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Badge tone="neutral">{listing.emails.length} dòng</Badge>
                {filters.address ? <Badge tone="accent">{filters.address}</Badge> : null}
                {filters.domain ? <Badge tone="neutral">{filters.domain}</Badge> : null}
                <Button type="button" size="sm" variant="ghost" icon={RotateCcw} onClick={clearFilters} disabled={!activeFilterCount}>
                  Xóa lọc
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDomainFilter('')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                  !filters.domain
                    ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'border-[var(--line)] bg-white/80 text-[var(--muted)] hover:text-[var(--ink)]',
                )}
                >
                  Tất cả domain
                </button>
              {visibleDomainOptions.map((item) => {
                const isActive = filters.domain === item.domain

                return (
                  <button
                    key={item.domain}
                    type="button"
                    onClick={() => setDomainFilter(item.domain)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'border-transparent bg-[rgba(19,93,102,0.14)] text-[var(--accent-strong)]'
                        : 'border-[var(--line)] bg-white/80 text-[var(--muted)] hover:text-[var(--ink)]',
                    )}
                  >
                    <span>{item.domain}</span>
                    <Badge tone={isActive ? 'accent' : 'neutral'}>{item.count}</Badge>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Panel>

      <EmailFeedList
        title="Mail hệ thống"
        description="Danh sách quản trị toàn hệ thống. Chọn domain nhanh ở header, lọc theo người nhận khi cần và mở modal để xem chi tiết hoặc xóa mail."
        total={listing.count || listing.emails.length}
        emails={listing.emails}
        selectedEmailId={selectedEmailId}
        loading={listing.loading}
        onOpenEmail={setSelectedEmailId}
        emptyTitle="Chưa có mail hệ thống"
        emptyDescription="Thử bỏ bộ lọc người nhận/domain nếu feed đang rỗng, hoặc chờ worker forward thêm mail mới vào server."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone="warning">Phạm vi hệ thống</Badge>
            {filters.domain ? <Badge tone="neutral">{filters.domain}</Badge> : null}
            {filters.address ? <Badge tone="accent">{filters.address}</Badge> : null}
            <Badge tone="accent">{listing.emails.length} mail</Badge>
            <CursorPagination
              page={emailPager.page}
              count={listing.emails.length}
              hasPrev={emailPager.hasPrev}
              hasNext={listing.hasMore}
              onPrev={emailPager.goPrev}
              onNext={emailPager.goNext}
            />
          </div>
        )}
      />

      <EmailDetailModal
        open={Boolean(selectedEmailId)}
        email={selectedEmail}
        loadingDetail={loadingDetail}
        includeRawMime={includeRawMime}
        onToggleRawMime={setIncludeRawMime}
        deletingEmail={deletingEmail}
        onDeleteEmail={handleDeleteEmail}
        onClose={handleCloseEmailModal}
      />
    </div>
  )
}
