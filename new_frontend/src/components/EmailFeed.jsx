import { memo, useEffect } from 'react'
import { MailOpen, Send, Trash2, UserRound, X } from 'lucide-react'
import { getEmailPreview, getSenderLabel } from '../lib/email-feed.js'
import { cn, formatDateTime, truncate } from '../lib/format.js'
import { Badge, Button, Checkbox, CodeBlock, Panel } from './ui.jsx'

export function EmailDetailModal({
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
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Chi tiết email</p>
            <h2 className="max-w-3xl font-display text-[1.55rem] leading-[0.96] tracking-[-0.04em] text-[var(--ink)] sm:text-[2.2rem]">
              {truncate(email?.subject || '(No Subject)', 72)}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Checkbox
              label="Kèm MIME gốc"
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
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người gửi</p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{getSenderLabel(email)}</p>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người nhận</p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{email.to}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Nhận lúc</p>
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
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Nội dung text</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                  {email.text || 'Không có text body'}
                </p>
              </div>

              {email.rawMime ? (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">MIME gốc (base64)</p>
                  <CodeBlock className="max-h-64">{email.rawMime}</CodeBlock>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button variant="danger" icon={Trash2} loading={deletingEmail} onClick={onDeleteEmail}>
                  Xóa email này
                </Button>
                {loadingDetail ? <Badge tone="warning">Đang tải lại chi tiết...</Badge> : null}
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

export function EmailFeedList({
  title,
  description,
  total,
  emails,
  selectedEmailId,
  loading,
  onOpenEmail,
  emptyTitle,
  emptyDescription,
  action,
}) {
  return (
    <Panel
      eyebrow="Hộp thư"
      title={title}
      description={description}
      tone="slate"
      className="min-h-[28rem]"
      action={action || (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{total} mail</Badge>
          {loading ? <Badge tone="warning">Đang đồng bộ...</Badge> : null}
        </div>
      )}
    >
      {emails.length ? (
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_180px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
            <p>Email</p>
            <p>Người gửi / Người nhận</p>
            <p className="text-right">Thời gian nhận</p>
          </div>

          <div className="grid gap-0">
            {emails.map((email) => {
              return (
                <EmailFeedRow
                  key={email.id}
                  email={email}
                  isActive={selectedEmailId === email.id}
                  onOpenEmail={onOpenEmail}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
          <p className="font-display text-2xl text-[var(--ink)]">{emptyTitle}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{emptyDescription}</p>
        </div>
      )}
    </Panel>
  )
}

const EmailFeedRow = memo(function EmailFeedRow({ email, isActive, onOpenEmail }) {
  return (
    <button
      type="button"
      onClick={() => onOpenEmail(email.id)}
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
          {email.groupCount ? <Badge tone="accent">{email.groupCount} nhóm</Badge> : null}
          <Badge tone="neutral" className="lg:hidden">{email.domain}</Badge>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">{getEmailPreview(email)}</p>
      </div>

      <div className="grid gap-2 text-sm text-[var(--ink)]">
        <div className="flex items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người gửi</p>
            <p className="truncate font-medium">{getSenderLabel(email)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Send className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Người nhận</p>
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
})
