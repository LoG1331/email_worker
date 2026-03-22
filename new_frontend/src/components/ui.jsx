import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react'
import { cn } from '../lib/format.js'
import { buildPaginationMeta } from '../lib/pagination.js'

const PANEL_TONE_CLASS = {
  neutral: 'panel-tone-neutral',
  ocean: 'panel-tone-ocean',
  sage: 'panel-tone-sage',
  sand: 'panel-tone-sand',
  ember: 'panel-tone-ember',
  slate: 'panel-tone-slate',
}

const SECTION_TONE_CLASS = {
  neutral: 'section-tone-neutral',
  ocean: 'section-tone-ocean',
  sage: 'section-tone-sage',
  sand: 'section-tone-sand',
  ember: 'section-tone-ember',
  slate: 'section-tone-slate',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  icon: Icon,
  children,
  ...props
}) {
  const variantClass = {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
  }[variant]

  const sizeClass = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-4.5 py-3 text-sm',
    lg: 'px-5 py-3.5 text-base',
  }[size]

  return (
    <button
      className={cn(variantClass, sizeClass, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </button>
  )
}

export function Field({ label, hint, className, children }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
        {hint ? <span className="text-[11px] text-[var(--muted)]">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn('form-input', className)} {...props} />
}

export function TextArea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn('form-input resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('form-input appearance-none pr-10', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cn('inline-flex items-center gap-3 text-sm font-medium text-[var(--ink)]', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border border-[var(--line)] accent-[var(--accent)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  )
}

export function Panel({
  title,
  eyebrow,
  description,
  action,
  tone = 'neutral',
  className,
  children,
}) {
  return (
    <section className={cn('panel rounded-[1.45rem] p-4 sm:p-5', PANEL_TONE_CLASS[tone] || PANEL_TONE_CLASS.neutral, className)}>
      {(title || description || action || eyebrow) ? (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">{eyebrow}</p> : null}
            {title ? <h2 className="font-display text-[1.5rem] leading-[1] tracking-[-0.04em] text-[var(--ink)] sm:text-[1.7rem]">{title}</h2> : null}
            {description ? <p className="max-w-2xl text-[13px] leading-5 text-[var(--muted)]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0 self-start">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function SectionHeader({ eyebrow, title, description, action, tone = 'neutral' }) {
  return (
    <section className={cn('section-header-shell', SECTION_TONE_CLASS[tone] || SECTION_TONE_CLASS.neutral)}>
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">{eyebrow}</p> : null}
          <h1 className="font-display text-[1.75rem] leading-[0.96] tracking-[-0.05em] text-[var(--ink)] sm:text-[2.2rem]">{title}</h1>
          {description ? <p className="max-w-3xl text-[13px] leading-5 text-[var(--muted)] sm:text-sm">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{action}</div> : null}
      </div>
    </section>
  )
}

export function Badge({ tone = 'neutral', children, className }) {
  const toneClass = {
    neutral: 'border-[var(--line)] bg-white/70 text-[var(--muted)]',
    accent: 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]',
    warning: 'border-transparent bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'border-transparent bg-[var(--danger-soft)] text-[var(--danger)]',
    success: 'border-transparent bg-[var(--success-soft)] text-[var(--success)]',
  }[tone]

  return <span className={cn('pill', toneClass, className)}>{children}</span>
}

export function AutoRefreshButton({ onClick, className, children = 'Làm mới' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'pill border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] transition hover:bg-[rgba(19,93,102,0.18)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function CompactPagination({
  total = 0,
  count = 0,
  offset = 0,
  limit = 50,
  onPrev,
  onNext,
  onLimitChange,
  limitOptions = [25, 50, 100],
  className,
}) {
  const { pageStart, pageEnd, hasPrev, hasNext } = buildPaginationMeta({
    total,
    count,
    offset,
    limit,
  })

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge tone="neutral">
        {pageStart}-{pageEnd} / {total}
      </Badge>
      {onLimitChange ? (
        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 text-sm font-semibold text-[var(--ink)]">
          <span className="text-[var(--muted)]">Mức tải</span>
          <select
            value={String(limit)}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-9 rounded-full bg-transparent pr-1 text-sm outline-none"
          >
            {limitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Badge tone="neutral">mức tải {limit}</Badge>
      )}
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
          hasPrev
            ? 'border-[var(--line)] bg-white/80 text-[var(--ink)] hover:bg-white'
            : 'cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]/60',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Trước</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
          hasNext
            ? 'border-[var(--line)] bg-white/80 text-[var(--ink)] hover:bg-white'
            : 'cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]/60',
        )}
      >
        <span>Sau</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function CursorPagination({
  page = 1,
  count = 0,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  className,
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge tone="neutral">Trang {page}</Badge>
      <Badge tone="neutral">{count} mục</Badge>
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
          hasPrev
            ? 'border-[var(--line)] bg-white/80 text-[var(--ink)] hover:bg-white'
            : 'cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]/60',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Trước</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
          hasNext
            ? 'border-[var(--line)] bg-white/80 text-[var(--ink)] hover:bg-white'
            : 'cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]/60',
        )}
      >
        <span>Sau</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function MetricCard({ label, value, helper, icon: Icon, tone = 'accent' }) {
  const accentClass = {
    accent: 'bg-[rgba(19,93,102,0.12)] text-[var(--accent)]',
    warning: 'bg-[rgba(161,90,28,0.12)] text-[var(--warning)]',
    danger: 'bg-[rgba(160,56,56,0.12)] text-[var(--danger)]',
    neutral: 'bg-[rgba(29,42,42,0.08)] text-[var(--ink)]',
  }[tone]

  return (
    <div className="muted-card rounded-[1.3rem] p-3.5 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
        {Icon ? (
          <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-[0.95rem]', accentClass)}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-[1.55rem] font-black tracking-[-0.04em] text-[var(--ink)]">{value}</p>
        {helper ? <p className="text-[11px] leading-4 text-[var(--muted)]">{helper}</p> : null}
      </div>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="panel rounded-[1.35rem] border-dashed px-5 py-8 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <p className="font-display text-[1.55rem] leading-none text-[var(--ink)]">{title}</p>
        <p className="text-[13px] leading-5 text-[var(--muted)]">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  )
}

export function KeyValueList({ items }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-[1.25rem] border border-[var(--line)] bg-white/65 px-4 py-3">
          <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{item.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-[var(--ink)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CodeBlock({ value, className }) {
  return (
    <pre className={cn('overflow-x-auto rounded-[1.25rem] border border-[var(--line)] bg-[#fcfaf6] p-4 text-xs leading-6 text-[var(--ink)]', className)}>
      {value}
    </pre>
  )
}

export function ModalShell({
  open,
  onClose,
  eyebrow,
  title,
  description,
  action,
  tone = 'neutral',
  size = 'lg',
  children,
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
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

  const sizeClass = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
  }[size] || 'max-w-4xl'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,28,0.48)] p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={cn(
          'panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-white/70 shadow-[0_34px_80px_-36px_rgba(15,37,38,0.72)] sm:rounded-[1.9rem]',
          PANEL_TONE_CLASS[tone] || PANEL_TONE_CLASS.neutral,
          sizeClass,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">{eyebrow}</p> : null}
            {(title || action) ? (
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                {title ? (
                  <h2 className="max-w-3xl font-display text-[1.4rem] leading-[0.98] tracking-[-0.04em] text-[var(--ink)] sm:text-[1.85rem]">
                    {title}
                  </h2>
                ) : null}
                {action ? <div className="min-w-0">{action}</div> : null}
              </div>
            ) : null}
            {description ? <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--muted)]">{description}</p> : null}
          </div>
          <div className="shrink-0">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-[var(--ink)] transition hover:bg-white"
              onClick={onClose}
              aria-label="Đóng modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
