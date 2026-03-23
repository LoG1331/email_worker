import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createEmailRegister,
  createRandomEmailRegister,
  deleteEmailsByIds,
  deleteEmailById,
  deleteEmailRegister,
  getEmailById,
  listEmailRegisters,
  listRegisteredEmails,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { EmailDetailModal, EmailFeedList } from '../components/EmailFeed.jsx'
import { AutoRefreshButton, Badge, Button, CompactPagination, CursorPagination, Input, Panel } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'
import { useCursorPager } from '../hooks/useCursorPager.js'

const DEFAULT_FILTERS = {
  address: '',
  search: '',
  limit: 50,
}

export default function EmailsView({ token }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [registrationFilters, setRegistrationFilters] = useState({
    limit: 50,
    offset: 0,
  })
  const [listing, setListing] = useState({
    loading: false,
    emails: [],
    count: 0,
    hasMore: false,
  })
  const [registrations, setRegistrations] = useState([])
  const [totalRegistrations, setTotalRegistrations] = useState(0)
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [registrationForm, setRegistrationForm] = useState({
    emailAddress: '',
  })
  const [registeringEmail, setRegisteringEmail] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [deletingRegistrationId, setDeletingRegistrationId] = useState(null)
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [includeRawMime, setIncludeRawMime] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState(false)
  const [selectedEmailIds, setSelectedEmailIds] = useState([])
  const [deletingSelectedEmails, setDeletingSelectedEmails] = useState(false)
  const deferredSearch = useDeferredValue(filters.search)
  const emailPager = useCursorPager()

  const selectedMailbox = useMemo(
    () => registrations.find((registration) => registration.emailAddress === filters.address) || null,
    [filters.address, registrations],
  )

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

  async function loadRegistrations({ showError = true } = {}) {
    setLoadingRegistrations(true)

    try {
      const response = await listEmailRegisters(token, {
        limit: registrationFilters.limit,
        offset: registrationFilters.offset,
      })
      setRegistrations(response.registrations)
      setTotalRegistrations(response.total)

      if (!response.registrations.length && registrationFilters.offset > 0 && response.total <= registrationFilters.offset) {
        setRegistrationFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }

      return null
    } finally {
      setLoadingRegistrations(false)
    }
  }

  async function loadList({ showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setListing((current) => ({ ...current, loading: true }))
    }

    try {
      const response = await listRegisteredEmails(token, {
        address: filters.address,
        search: deferredSearch,
        limit: filters.limit,
        cursor: emailPager.cursor,
      })
      emailPager.sync(response)
      setSelectedEmailIds((current) => current.filter((id) => response.emails.some((email) => email.id === id)))
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
    void loadRegistrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationFilters.limit, registrationFilters.offset, token])

  useEffect(() => {
    if (!registrations.length) {
      setSelectedEmailIds([])
      setListing({
        loading: false,
        emails: [],
        count: 0,
        hasMore: false,
      })
      return
    }

    void loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, emailPager.cursor, filters.address, filters.limit, registrations.length, token])

  const refreshNow = useAutoRefresh(async () => {
    if (!registrations.length) {
      return
    }

    await loadList({
      showLoading: false,
      showError: false,
    })
  }, 10000, registrations.length > 0)

  function focusMailbox(emailAddress) {
    setFilters((current) => ({
      ...current,
      address: emailAddress,
    }))
    emailPager.reset()
  }

  async function handleCreateRegistration(event) {
    event.preventDefault()
    setRegisteringEmail(true)

    try {
      const response = await createEmailRegister(token, registrationForm)
      setRegistrationForm({ emailAddress: '' })
      setRegistrationFilters((current) => ({ ...current, offset: 0 }))
      focusMailbox(response.registration.emailAddress)
      toast.success('Đã đăng ký hộp thư theo dõi')
      await loadRegistrations({ showError: false })
      await loadList({
        showLoading: false,
        showError: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setRegisteringEmail(false)
    }
  }

  async function handleCreateRandomRegistration() {
    setGeneratingEmail(true)

    try {
      const response = await createRandomEmailRegister(token)
      setRegistrationFilters((current) => ({ ...current, offset: 0 }))
      focusMailbox(response.registration.emailAddress)
      toast.success(`Đã tạo hộp thư mới: ${response.registration.emailAddress}`)
      await loadRegistrations({ showError: false })
      await loadList({
        showLoading: false,
        showError: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setGeneratingEmail(false)
    }
  }

  async function handleDeleteRegistration(registration) {
    setDeletingRegistrationId(registration.id)

    try {
      await deleteEmailRegister(token, registration.id)
      toast.success('Đã gỡ hộp thư theo dõi')

      if (filters.address === registration.emailAddress) {
        setFilters((current) => ({ ...current, address: '' }))
        emailPager.reset()
      }

      if (selectedEmail?.to === registration.emailAddress) {
        setSelectedEmail(null)
        setSelectedEmailId(null)
      }

      await loadRegistrations({ showError: false })
      await loadList({
        showLoading: false,
        showError: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingRegistrationId(null)
    }
  }

  async function handleDeleteEmail() {
    if (!selectedEmailId) {
      return
    }

    setDeletingEmail(true)

    try {
      await deleteEmailById(token, selectedEmailId)
      toast.success('Đã xóa email')
      setSelectedEmailIds((current) => current.filter((id) => id !== selectedEmailId))
      setSelectedEmail(null)
      setSelectedEmailId(null)
      const response = await loadList({
        showLoading: false,
        showError: false,
      })
      if (!response?.count && emailPager.hasPrev) {
        emailPager.goPrev()
      }
      await loadRegistrations({ showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingEmail(false)
    }
  }

  async function handleDeleteSelectedEmails() {
    if (!selectedEmailIds.length) {
      return
    }

    setDeletingSelectedEmails(true)

    try {
      const response = await deleteEmailsByIds(token, selectedEmailIds)
      const deletedIds = Array.isArray(response.deletedIds) ? response.deletedIds : []
      const deletedCount = Number(response.deleted || deletedIds.length || 0)

      if (deletedCount > 0) {
        toast.success(`Đã xóa ${deletedCount} email`)
      }

      if (response.missingIds?.length || response.deniedIds?.length) {
        toast.error(deletedCount ? 'Một phần email không còn khả dụng để xóa.' : 'Không thể xóa các email đã chọn.')
      }

      if (selectedEmailId && deletedIds.includes(selectedEmailId)) {
        setSelectedEmail(null)
        setSelectedEmailId(null)
      }

      setSelectedEmailIds([])
      const listResponse = await loadList({
        showLoading: false,
        showError: false,
      })
      if (!listResponse?.count && emailPager.hasPrev) {
        emailPager.goPrev()
      }
      await loadRegistrations({ showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingSelectedEmails(false)
    }
  }

  function handleToggleEmailSelection(emailId, checked) {
    setSelectedEmailIds((current) => {
      if (!checked) {
        return current.filter((id) => id !== emailId)
      }

      if (current.includes(emailId)) {
        return current
      }

      return [...current, emailId]
    })
  }

  function handleTogglePageSelection(checked) {
    if (!checked) {
      setSelectedEmailIds([])
      return
    }

    setSelectedEmailIds(listing.emails.map((email) => email.id))
  }

  const allVisibleSelected = listing.emails.length > 0 && listing.emails.every((email) => selectedEmailIds.includes(email.id))

  function handleCloseEmailModal() {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-3.5 sm:p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Hộp thư đã đăng ký</p>
            <AutoRefreshButton onClick={refreshNow} />
            <Badge tone="success">Chỉ hộp thư đã đăng ký</Badge>
            <CompactPagination
              total={totalRegistrations}
              count={registrations.length}
              offset={registrationFilters.offset}
              limit={registrationFilters.limit}
              onLimitChange={(limit) => setRegistrationFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setRegistrationFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setRegistrationFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
            {filters.address ? <Badge tone="accent">{filters.address}</Badge> : null}
            {selectedMailbox ? <Badge tone="neutral">{selectedMailbox.domain}</Badge> : null}
            {listing.loading || loadingRegistrations ? <Badge tone="warning">Đang đồng bộ...</Badge> : null}
          </div>

          <div className="rounded-[1.4rem] border border-[var(--line)] bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(241,248,246,0.88))] p-3 sm:p-3.5">
            <form className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_auto]" onSubmit={handleCreateRegistration}>
              <div className="min-w-0">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={registrationForm.emailAddress}
                    onChange={(event) => setRegistrationForm({ emailAddress: event.target.value })}
                    placeholder="alice@example.com"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button className="w-full md:w-auto" type="submit" icon={Plus} loading={registeringEmail}>
                      Đăng ký
                    </Button>
                    <Button
                      className="w-full md:w-auto"
                      type="button"
                      variant="secondary"
                      loading={generatingEmail}
                      onClick={handleCreateRandomRegistration}
                    >
                      Lấy mail mới
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                <button
                  type="button"
                  onClick={() => focusMailbox('')}
                  className={cn(
                    'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors',
                    !filters.address
                      ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border-[var(--line)] bg-white/72 text-[var(--muted)] hover:text-[var(--ink)]',
                  )}
                >
                  Tất cả hộp thư
                  <Badge tone={!filters.address ? 'accent' : 'neutral'}>{registrations.length}</Badge>
                </button>
              </div>
            </form>

            {registrations.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {registrations.slice(0, 6).map((registration) => {
                  const isActive = filters.address === registration.emailAddress

                  return (
                    <button
                      key={registration.id}
                      type="button"
                      onClick={() => focusMailbox(registration.emailAddress)}
                      className={cn(
                        'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'border-transparent bg-[rgba(19,93,102,0.14)] text-[var(--accent-strong)]'
                          : 'border-[var(--line)] bg-white/80 text-[var(--muted)] hover:text-[var(--ink)]',
                      )}
                    >
                      <span className="max-w-[13rem] truncate">{registration.emailAddress}</span>
                      <Badge tone={isActive ? 'accent' : 'neutral'}>{registration.emailCount}</Badge>
                    </button>
                  )
                })}
                {registrations.length > 6 ? <Badge tone="neutral">+{registrations.length - 6} thêm</Badge> : null}
              </div>
            ) : (
              <div className="mt-3 rounded-[1rem] border border-dashed border-[var(--line)] bg-white/46 px-3.5 py-2.5 text-sm text-[var(--muted)]">
                Chưa có hộp thư nào được đăng ký.
              </div>
            )}
          </div>

          {registrations.length ? (
            <div className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white/64">
              <div className="grid gap-0">
                {registrations.map((registration) => {
                  const isActive = filters.address === registration.emailAddress

                  return (
                    <div
                      key={registration.id}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 last:border-none',
                        isActive ? 'bg-[rgba(19,93,102,0.08)]' : '',
                      )}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => focusMailbox(registration.emailAddress)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[var(--ink)]">{registration.emailAddress}</p>
                          <Badge tone={isActive ? 'accent' : 'neutral'}>{registration.domain}</Badge>
                          {isActive ? <Badge tone="success">Đang xem</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {registration.emailCount} email
                          {registration.latestReceivedAt ? ` · mới nhất ${formatDateTime(registration.latestReceivedAt)}` : ' · chưa có mail'}
                        </p>
                      </button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        loading={deletingRegistrationId === registration.id}
                        onClick={() => handleDeleteRegistration(registration)}
                      >
                        Gỡ
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <EmailFeedList
        title="Mail đã đăng ký"
        total={listing.count || listing.emails.length}
        emails={listing.emails}
        selectedEmailId={selectedEmailId}
        selectedEmailIds={selectedEmailIds}
        selectable
        loading={listing.loading}
        onOpenEmail={setSelectedEmailId}
        onToggleEmailSelection={handleToggleEmailSelection}
        onTogglePageSelection={handleTogglePageSelection}
        emptyTitle="Chưa có mail để hiển thị"
        emptyDescription="Đăng ký hộp thư trước, hoặc chọn lại bộ lọc nếu bạn đang xem một địa chỉ cụ thể."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="min-w-[220px] grow sm:max-w-[18rem]">
              <span className="sr-only">Tìm kiếm email</span>
              <div className="flex min-h-[40px] items-center gap-2 rounded-[0.95rem] border border-white/70 bg-white/88 px-3.5">
                <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <Input
                  className="min-h-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none"
                  value={filters.search}
                  onChange={(event) => {
                    emailPager.reset()
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }}
                  placeholder="Tìm subject, body, header..."
                />
              </div>
            </label>
            {filters.search ? <Badge tone="warning">{filters.search}</Badge> : null}
            {selectedEmailIds.length ? <Badge tone="success">{selectedEmailIds.length} đã chọn</Badge> : null}
            <Badge tone="accent">{listing.emails.length} mail</Badge>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleTogglePageSelection(true)} disabled={!listing.emails.length || allVisibleSelected}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleTogglePageSelection(false)} disabled={!selectedEmailIds.length}>
              Bỏ chọn
            </Button>
            <Button type="button" size="sm" variant="danger" icon={Trash2} loading={deletingSelectedEmails} onClick={handleDeleteSelectedEmails} disabled={!selectedEmailIds.length}>
              Xóa đã chọn
            </Button>
            {filters.address ? <Badge tone="neutral">{filters.address}</Badge> : null}
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
        key={selectedEmailId || 'email-detail-modal'}
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
