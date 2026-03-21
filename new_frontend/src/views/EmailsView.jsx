import { useEffect, useMemo, useState } from 'react'
import { MailOpen, Plus, Send, Trash2, UserRound, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createEmailRegister,
  deleteEmailById,
  deleteEmailRegister,
  getEmailById,
  listEmailRegisters,
  listEmails,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime, truncate } from '../lib/format.js'
import { Badge, Button, Checkbox, CodeBlock, Field, Input, Panel } from '../components/ui.jsx'

function getSenderLabel(email) {
  const name = String(email?.from?.name || '').trim()
  const address = String(email?.from?.address || email?.envelopeFrom || '').trim()

  if (name && address) {
    return `${name} <${address}>`
  }

  return name || address || 'Unknown sender'
}

function getEmailPreview(email) {
  const preview = String(email?.text || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!preview) {
    return 'Không có preview text cho email này.'
  }

  return truncate(preview, 180)
}

function EmailDetailModal({
  open,
  email,
  loadingDetail,
  includeRawMime,
  onToggleRawMime,
  deletingEmail,
  onDeleteEmail,
  onClose,
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,28,0.48)] p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="panel panel-tone-sage flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/70 shadow-[0_34px_80px_-36px_rgba(15,37,38,0.72)] sm:rounded-[1.9rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Email detail</p>
            <h2 className="max-w-3xl font-display text-[1.55rem] leading-[0.96] tracking-[-0.04em] text-[var(--ink)] sm:text-[2.2rem]">
              {truncate(email?.subject || '(No Subject)', 72)}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Modal detail để list mail giữ full chiều ngang. Mở mail nào thì đọc toàn bộ nội dung và thao tác trong khung này.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Checkbox
              label="include raw MIME"
              checked={includeRawMime}
              onChange={(event) => onToggleRawMime(event.target.checked)}
              className="min-w-0"
            />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-[var(--ink)] transition hover:bg-white"
              onClick={onClose}
              aria-label="Đóng chi tiết email"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {email ? (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">From</p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{getSenderLabel(email)}</p>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">To</p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{email.to}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Received</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(email.receivedAt)}</p>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Domain</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{email.domain}</p>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Message ID</p>
                  <p className="mt-2 break-all text-sm font-semibold text-[var(--ink)]">{email.messageId || 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/80 p-4 sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Text body</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                  {email.text || 'Không có text body'}
                </p>
              </div>

              {email.rawMime ? (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Raw MIME base64</p>
                  <CodeBlock className="max-h-64">{email.rawMime}</CodeBlock>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button variant="danger" icon={Trash2} loading={deletingEmail} onClick={onDeleteEmail}>
                  Xóa email này
                </Button>
                {loadingDetail ? <Badge tone="warning">Đang tải lại detail…</Badge> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 px-5 py-10 text-sm text-[var(--muted)]">
              Đang tải nội dung email...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmailsView({ token, account, accessibleDomains }) {
  const [filters, setFilters] = useState({
    domain: '',
    address: '',
    limit: 50,
    offset: 0,
  })
  const [listing, setListing] = useState({
    loading: false,
    total: 0,
    emails: [],
  })
  const [registrations, setRegistrations] = useState([])
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [registrationForm, setRegistrationForm] = useState({
    emailAddress: '',
  })
  const [registeringEmail, setRegisteringEmail] = useState(false)
  const [deletingRegistrationId, setDeletingRegistrationId] = useState(null)
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [includeRawMime, setIncludeRawMime] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState(false)

  const currentRows = listing.emails
  const selectedMailbox = useMemo(
    () => registrations.find((registration) => registration.emailAddress === filters.address) || null,
    [filters.address, registrations],
  )

  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmail(null)
      return
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
    if (selectedEmailId && !currentRows.some((email) => email.id === selectedEmailId)) {
      setSelectedEmailId(null)
      setSelectedEmail(null)
    }
  }, [currentRows, selectedEmailId])

  async function loadRegistrations({ showError = true } = {}) {
    setLoadingRegistrations(true)

    try {
      const response = await listEmailRegisters(token)
      setRegistrations(response.registrations)

      if (!filters.address && response.registrations[0]?.emailAddress) {
        setFilters((current) => ({
          ...current,
          address: response.registrations[0].emailAddress,
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
      const response = await listEmails(token, filters)
      setListing({
        loading: false,
        total: response.total,
        emails: response.emails,
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
  }, [])

  useEffect(() => {
    if (!account.isAdmin && !registrations.length) {
      setListing({
        loading: false,
        total: 0,
        emails: [],
      })
      return undefined
    }

    let cancelled = false

    async function refreshFeed({ silent = false } = {}) {
      const response = await loadList({
        showLoading: !silent,
        showError: !silent,
      })

      if (cancelled || response) {
        return
      }
    }

    void refreshFeed()

    const intervalId = window.setInterval(() => {
      void refreshFeed({ silent: true })
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.isAdmin, filters.address, filters.domain, registrations.length, token])

  function focusMailbox(emailAddress) {
    setFilters((current) => ({
      ...current,
      address: emailAddress,
      offset: 0,
    }))
  }

  async function handleCreateRegistration(event) {
    event.preventDefault()
    setRegisteringEmail(true)

    try {
      const response = await createEmailRegister(token, registrationForm)
      setRegistrationForm({ emailAddress: '' })
      focusMailbox(response.registration.emailAddress)
      toast.success('Đã đăng ký mailbox monitor')
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

  async function handleDeleteRegistration(registration) {
    setDeletingRegistrationId(registration.id)

    try {
      await deleteEmailRegister(token, registration.id)
      toast.success('Đã gỡ mailbox monitor')

      if (filters.address === registration.emailAddress) {
        setFilters((current) => ({ ...current, address: '' }))
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
      setSelectedEmail(null)
      setSelectedEmailId(null)
      await loadList({
        showLoading: false,
        showError: false,
      })
      await loadRegistrations({ showError: false })
    } catch (error) {
      toast.error(formatApiError(error))
    } finally {
      setDeletingEmail(false)
    }
  }

  function handleOpenEmail(emailId) {
    setSelectedEmailId(emailId)
    setSelectedEmail(null)
  }

  function handleCloseEmailModal() {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Mailbox toolbar</p>
              <Badge tone="accent">Auto refresh 10s</Badge>
              <Badge tone="neutral">Page 1 · limit 50</Badge>
              {listing.loading || loadingRegistrations ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
              {!account.isAdmin && selectedMailbox ? <Badge tone="accent">{selectedMailbox.emailAddress}</Badge> : null}
              {!account.isAdmin && selectedMailbox ? <Badge tone="neutral">{selectedMailbox.domain}</Badge> : null}
              {account.isAdmin && filters.address ? <Badge tone="accent">{filters.address}</Badge> : null}
              {account.isAdmin && filters.domain ? <Badge tone="neutral">{filters.domain}</Badge> : null}
              {!account.isAdmin ? <Badge tone="success">Registered only</Badge> : <Badge tone="warning">Admin filter</Badge>}
            </div>

          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/66 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">Đăng ký mailbox monitor</p>
                <p className="text-xs text-[var(--muted)]">
                  {accessibleDomains.length ? accessibleDomains.join(', ') : 'Mailbox phải nằm trong scope permission'}
                </p>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <Input
                  value={registrationForm.emailAddress}
                  onChange={(event) => setRegistrationForm({ emailAddress: event.target.value })}
                  placeholder="alice@example.com"
                />
                <div className="flex items-center md:justify-end">
                  <Button className="w-full md:w-auto" type="button" icon={Plus} loading={registeringEmail} onClick={handleCreateRegistration}>
                    Claim mailbox
                  </Button>
                </div>
              </div>
            </div>

            {account.isAdmin ? (
              <div className="grid gap-3 rounded-[1.4rem] border border-[var(--line)] bg-white/66 p-3 sm:grid-cols-2">
                <Field label="Address">
                  <Input
                    value={filters.address}
                    onChange={(event) => setFilters((current) => ({ ...current, address: event.target.value, offset: 0 }))}
                    placeholder="alice@example.com"
                  />
                </Field>
                <Field label="Domain">
                  <Input
                    value={filters.domain}
                    onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value, offset: 0 }))}
                    placeholder="example.com"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          {registrations.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Mailbox đã register</p>
                <p className="text-xs text-[var(--muted)]">{registrations.length} mailbox</p>
              </div>

              <div className="grid gap-2">
                {registrations.map((registration) => {
                  const isActive = filters.address === registration.emailAddress

                  return (
                    <div
                      key={registration.id}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3 transition-colors',
                        isActive
                          ? 'border-transparent bg-[linear-gradient(135deg,rgba(19,93,102,0.14),rgba(32,130,141,0.08))]'
                          : 'border-[var(--line)] bg-white/68',
                      )}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => focusMailbox(registration.emailAddress)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ink)]">{registration.emailAddress}</p>
                          <Badge tone={isActive ? 'accent' : 'neutral'}>{registration.domain}</Badge>
                          {isActive ? <Badge tone="success">Đang xem</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {registration.emailCount} emails · {registration.latestReceivedAt ? `mail mới nhất ${formatDateTime(registration.latestReceivedAt)}` : 'chưa có email'}
                        </p>
                      </button>

                      <Button type="button" variant="ghost" size="sm" loading={deletingRegistrationId === registration.id} onClick={() => handleDeleteRegistration(registration)}>
                        Gỡ
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
              Chưa có mailbox register.
            </div>
          )}
        </div>
      </Panel>

      <Panel
        eyebrow="Feed"
        title="Danh sách mail"
        description="List mail chiếm trọn vùng nhìn chính. Hàng mail hiển thị subject, sender, recipient, preview ngắn và chỉ mở detail bằng modal khi bạn chọn một mail."
        tone="slate"
        className="min-h-[28rem]"
        action={<Badge tone="accent">{listing.total} mails</Badge>}
      >
        {currentRows.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_180px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Mail</p>
              <p>Sender / Recipient</p>
              <p className="text-right">Received</p>
            </div>

            <div className="grid gap-0">
              {currentRows.map((email) => {
                const isActive = selectedEmailId === email.id

                return (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => handleOpenEmail(email.id)}
                    className={cn(
                      'grid w-full gap-4 border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
                      'lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_180px] lg:items-center',
                      isActive
                        ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
                        : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--ink)]">{truncate(email.subject || '(No Subject)', 96)}</p>
                        {email.groupCount ? <Badge tone="accent">{email.groupCount} group</Badge> : null}
                        <Badge tone="neutral" className="lg:hidden">{email.domain}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">{getEmailPreview(email)}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-[var(--ink)]">
                      <div className="flex items-start gap-2">
                        <UserRound className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">From</p>
                          <p className="truncate font-medium">{getSenderLabel(email)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Send className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">To</p>
                          <p className="truncate font-medium">{email.to}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)] lg:justify-end">
                      <Badge tone="neutral" className="hidden lg:inline-flex">{email.domain}</Badge>
                      <div className="flex items-center gap-2">
                        <MailOpen className="h-4 w-4 text-[var(--muted)]" />
                        <p className="font-medium">{formatDateTime(email.receivedAt)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có mail để hiển thị</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Claim mailbox trước hoặc đổi bộ lọc header để nạp đúng feed bạn đang cần theo dõi.
            </p>
          </div>
        )}
      </Panel>

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
