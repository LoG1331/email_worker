import { memo, useEffect, useState } from 'react'
import { MailOpen, Send, Trash2, UserRound, X } from 'lucide-react'
import { getEmailBodyText, getEmailPreview, getSenderLabel } from '../lib/email-feed.js'
import { cn, formatDateTime, truncate } from '../lib/format.js'
import { Badge, Button, Checkbox, CodeBlock, Panel } from './ui.jsx'

function buildEmailHtmlPreviewDoc(html) {
  const source = String(html || '').trim()
  if (!source) {
    return ''
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 20px;
        background: #fffdfa;
        color: #182526;
        font: 14px/1.6 Manrope, system-ui, sans-serif;
        overflow-wrap: anywhere;
      }
      img, video, iframe, table {
        max-width: 100%;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>${source}</body>
</html>`
}

function sanitizeEmailHtmlPreview(html) {
  const source = String(html || '').trim()
  if (!source) {
    return ''
  }

  if (typeof window === 'undefined' || typeof window.DOMParser !== 'function') {
    return source
  }

  const document = new window.DOMParser().parseFromString(source, 'text/html')

  document.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach((node) => {
    node.remove()
  })

  document.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = String(attribute.name || '').toLowerCase()
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        node.removeAttribute(attribute.name)
      }
    })

    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noreferrer noopener')
    }

    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy')
      node.setAttribute('referrerpolicy', 'no-referrer')
    }
  })

  return String(document.body?.innerHTML || '').trim()
}

function EmailHtmlSnippet({ html }) {
  const safeHtml = sanitizeEmailHtmlPreview(html)

  if (!safeHtml) {
    return <p className="text-sm leading-6 text-[var(--muted)]">Email này có nội dung HTML.</p>
  }

  return (
    <div
      className="email-html-snippet mt-1.5 rounded-[1rem] border border-[var(--line)] bg-white/72 px-3 py-2.5"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

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
  const [previewMode, setPreviewMode] = useState(null)

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

  const bodyText = getEmailBodyText(email)
  const hasHtmlPreview = Boolean(String(email?.html || '').trim())
  const htmlPreviewDoc = hasHtmlPreview ? buildEmailHtmlPreviewDoc(email.html) : ''
  const activePreviewMode = previewMode || (hasHtmlPreview ? 'html' : 'text')

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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                    {activePreviewMode === 'html' ? 'HTML preview' : 'Nội dung text'}
                  </p>
                  <div className="inline-flex rounded-full border border-[var(--line)] bg-white/88 p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('html')}
                      disabled={!hasHtmlPreview}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors',
                        activePreviewMode === 'html'
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]',
                        !hasHtmlPreview ? 'cursor-not-allowed opacity-40' : '',
                      )}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('text')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors',
                        activePreviewMode === 'text'
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]',
                      )}
                    >
                      Text
                    </button>
                  </div>
                </div>

                {activePreviewMode === 'html' && hasHtmlPreview ? (
                  <div className="mt-3 overflow-hidden rounded-[1.15rem] border border-[var(--line)] bg-[#fffdfa]">
                    <iframe
                      title="Email HTML preview"
                      srcDoc={htmlPreviewDoc}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      className="h-[26rem] w-full bg-transparent"
                    />
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                    {bodyText || 'Không có text body'}
                  </p>
                )}
              </div>

              {email.rawMime ? (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">MIME gốc (base64)</p>
                  <CodeBlock value={email.rawMime} className="max-h-64" />
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
  selectedEmailIds = [],
  selectable = false,
  loading,
  onOpenEmail,
  onToggleEmailSelection,
  onTogglePageSelection,
  emptyTitle,
  emptyDescription,
  action,
}) {
  const selectedCount = selectedEmailIds.length
  const allVisibleSelected = selectable && emails.length > 0 && emails.every((email) => selectedEmailIds.includes(email.id))

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
          <div
            className={cn(
              'hidden items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid',
              selectable
                ? 'lg:grid-cols-[52px_minmax(0,1.2fr)_minmax(220px,0.68fr)_180px]'
                : 'lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_180px]',
            )}
          >
            {selectable ? (
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-[var(--line)] accent-[var(--accent)]"
                  checked={allVisibleSelected}
                  onChange={(event) => onTogglePageSelection?.(event.target.checked)}
                  aria-label={allVisibleSelected ? 'Bỏ chọn toàn bộ email trong trang' : 'Chọn toàn bộ email trong trang'}
                />
              </div>
            ) : null}
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
                  isChecked={selectedEmailIds.includes(email.id)}
                  selectable={selectable}
                  onOpenEmail={onOpenEmail}
                  onToggleSelection={onToggleEmailSelection}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
          <p className="font-display text-2xl text-[var(--ink)]">{emptyTitle}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{emptyDescription}</p>
          {selectable && selectedCount ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {selectedCount} email đang được chọn sẽ tự bỏ khi danh sách trống.
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

const EmailFeedRow = memo(function EmailFeedRow({
  email,
  isActive,
  isChecked,
  selectable,
  onOpenEmail,
  onToggleSelection,
}) {
  return (
    <div
      className={cn(
        'grid gap-3 border-b border-[var(--line)] last:border-none',
        selectable ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1',
        isActive
          ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
          : isChecked
            ? 'bg-[rgba(19,93,102,0.06)]'
            : 'bg-transparent',
      )}
    >
      {selectable ? (
        <div className="flex items-start justify-center px-3 pt-4 sm:px-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border border-[var(--line)] accent-[var(--accent)]"
            checked={Boolean(isChecked)}
            onChange={(event) => onToggleSelection?.(email.id, event.target.checked)}
            aria-label={`Chọn email ${email.id}`}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenEmail(email.id)}
        className={cn(
          'grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-[rgba(19,93,102,0.05)] sm:px-5',
          selectable ? 'pl-0 sm:pl-0' : '',
          'lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_180px] lg:items-center',
        )}
      >
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--ink)]">{truncate(email.subject || '(No Subject)', 96)}</p>
            {email.groupCount ? <Badge tone="accent">{email.groupCount} nhóm</Badge> : null}
            {isChecked ? <Badge tone="success">Đã chọn</Badge> : null}
            <Badge tone="neutral" className="lg:hidden">{email.domain}</Badge>
          </div>
          {email.text ? (
            <p className="text-sm leading-6 text-[var(--muted)]">{getEmailPreview(email)}</p>
          ) : email.html ? (
            <EmailHtmlSnippet html={email.html} />
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">{getEmailPreview(email)}</p>
          )}
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
    </div>
  )
})
