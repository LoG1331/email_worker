import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, UserRound, X } from 'lucide-react'
import { listUsers } from '../lib/api.js'
import { cn, formatApiError } from '../lib/format.js'
import { Badge, Input } from './ui.jsx'

const PAGE_SIZE = 50

function userLabel(user) {
  if (!user) {
    return ''
  }

  return user.displayName ? `@${user.username} · ${user.displayName}` : `@${user.username}`
}

/**
 * Chọn user từ danh sách thay vì gõ tay userId.
 * Tìm kiếm chạy trên server nên không bị giới hạn bởi số user đã tải sẵn.
 */
export default function UserPicker({
  token,
  value,
  onChange,
  label = 'Người dùng',
  placeholder = 'Chọn người dùng',
  hint,
  error,
  allowClear = true,
  disabled = false,
  className,
}) {
  const listboxId = useId()
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [pickedUser, setPickedUser] = useState(null)

  const selectedId = value ? String(value) : ''

  // Giữ user vừa chọn để nhãn không mất khi danh sách tải lại theo từ khoá mới,
  // nhưng vẫn ưu tiên dữ liệu tươi từ danh sách nếu tìm thấy.
  const selectedUser = useMemo(() => {
    if (!selectedId) {
      return null
    }

    const fromList = users.find((user) => String(user.id) === selectedId)
    if (fromList) {
      return fromList
    }

    return pickedUser && String(pickedUser.id) === selectedId ? pickedUser : null
  }, [pickedUser, selectedId, users])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)

      try {
        const response = await listUsers(token, {
          q: query.trim() || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        })

        if (!cancelled) {
          setUsers(response.users)
          setTotal(response.total)
          setLoadError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setUsers([])
          setTotal(0)
          setLoadError(formatApiError(requestError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, query ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [open, query, token])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    searchInputRef.current?.focus()

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const buttonText = useMemo(() => {
    if (selectedUser) {
      return userLabel(selectedUser)
    }

    return selectedId ? `User #${selectedId}` : placeholder
  }, [placeholder, selectedId, selectedUser])

  function handleSelect(user) {
    setPickedUser(user)
    onChange?.(String(user.id), user)
    setOpen(false)
  }

  function handleClear(event) {
    event.stopPropagation()
    setPickedUser(null)
    onChange?.('', null)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)} ref={containerRef}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
        {hint && !error ? <span className="text-[11px] text-[var(--muted)]">{hint}</span> : null}
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'form-input flex w-full items-center gap-2 text-left',
            error && 'border-[var(--danger)]',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <UserRound className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className={cn('min-w-0 flex-1 truncate', !selectedId && 'text-[var(--muted)]')}>
            {buttonText}
          </span>
          {selectedId && allowClear && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Bỏ chọn người dùng"
              onClick={handleClear}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  handleClear(event)
                }
              }}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--muted)] transition', open && 'rotate-180')} />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-[1.1rem] border border-[var(--line)] bg-white shadow-[0_24px_50px_-24px_rgba(15,37,38,0.55)]">
            <div className="border-b border-[var(--line)] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  ref={searchInputRef}
                  className="min-h-[40px] rounded-[0.85rem] py-2 pl-9 pr-3 text-sm"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo username, tên hiển thị, telegram"
                />
              </div>
            </div>

            <div id={listboxId} role="listbox" className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">Đang tải danh sách…</p>
              ) : loadError ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--danger)]">{loadError}</p>
              ) : users.length ? (
                users.map((user) => {
                  const isSelected = String(user.id) === selectedId

                  return (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(user)}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left transition last:border-none',
                        isSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[rgba(19,93,102,0.06)]',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">@{user.username}</p>
                          {user.isAdmin ? <Badge tone="accent">admin</Badge> : null}
                          {user.status !== 'active' ? <Badge tone="warning">{user.status}</Badge> : null}
                        </div>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {user.displayName || 'Không có tên hiển thị'} · ID {user.id}
                        </p>
                      </div>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" /> : null}
                    </button>
                  )
                })
              ) : (
                <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                  {query ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}
                </p>
              )}
            </div>

            {!loading && !loadError && total > users.length ? (
              <p className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--muted)]">
                Hiển thị {users.length} / {total} người dùng. Gõ để tìm thêm.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <span className="text-[11px] font-semibold text-[var(--danger)]">{error}</span> : null}
    </div>
  )
}
