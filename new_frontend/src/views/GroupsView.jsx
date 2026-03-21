import { useEffect, useState } from 'react'
import { FolderKanban, MailOpen, Plus, Send, Trash2, UserRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  addGroupEmails,
  createGroup,
  deleteGroup,
  listEmailRegisters,
  getGroup,
  getGroupEmails,
  listGroups,
  removeGroupEmail,
  updateGroup,
} from '../lib/api.js'
import { cn, formatApiError, formatDateTime, parseIdList, truncate } from '../lib/format.js'
import { Badge, Button, Checkbox, Field, Input, ModalShell, Panel, TextArea } from '../components/ui.jsx'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function GroupColorPicker({ value, onChange }) {
  return (
    <Field label="Color" hint="Mở bảng màu hệ thống để chọn trực tiếp">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-[1rem] border border-[var(--line)] bg-white/82 px-3 py-2 transition hover:bg-white">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-12 cursor-pointer rounded-[0.9rem] border border-white/80 bg-transparent p-1"
            aria-label="Chọn màu group"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Màu hiện tại</p>
            <p className="text-sm font-semibold tracking-[0.02em] text-[var(--ink)]">{value}</p>
          </div>
        </label>

        <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/58 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          Không dùng preset cố định. Mỗi group chọn màu riêng ngay từ bảng màu.
        </div>
      </div>
    </Field>
  )
}

function GroupCreateModal({ open, form, onChange, onSubmit, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Group"
      title="Tạo group mới"
      tone="sand"
      size="md"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field label="Name">
          <Input className={COMPACT_INPUT_CLASS} value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <GroupColorPicker value={form.color} onChange={(value) => onChange((current) => ({ ...current, color: value }))} />
        <Field label="Description">
          <TextArea className={COMPACT_INPUT_CLASS} rows={3} value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" icon={Plus}>Tạo group</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </form>
    </ModalShell>
  )
}

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

function GroupListItem({ group, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full gap-4 border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
        'lg:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.8fr)_200px] lg:items-center',
        active
          ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
          : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: group.color }} />
          <p className="font-semibold text-[var(--ink)]">{group.name}</p>
          <Badge tone="accent">{group.emailCount} mails</Badge>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">{truncate(group.description || 'Không có mô tả', 160)}</p>
      </div>

      <div className="grid gap-2 text-sm text-[var(--ink)]">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-[var(--muted)]" />
          <p className="min-w-0 truncate text-sm text-[var(--muted)]">
            <span className="font-black uppercase tracking-[0.16em]">Owner</span>
            <span className="ml-2 font-medium text-[var(--ink)]">{` ${group.owner?.username || `user:${group.ownerUserId}`}`}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-[var(--muted)]" />
          <p className="min-w-0 truncate text-sm text-[var(--muted)]">
            <span className="font-black uppercase tracking-[0.16em]">Group ID</span>
            <span className="ml-2 font-medium text-[var(--ink)]">{` #${group.id}`}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)] lg:justify-end">
        <div className="space-y-1 text-left lg:text-right">
          <Badge tone="neutral">Updated</Badge>
          <div className="flex items-center gap-2 lg:justify-end">
            <MailOpen className="h-4 w-4 text-[var(--muted)]" />
            <p className="font-medium">{formatDateTime(group.updatedAt)}</p>
          </div>
        </div>
      </div>
    </button>
  )
}

function GroupDetailModal({
  open,
  group,
  registrations,
  loadingRegistrations,
  loadingDetail,
  includeRawMime,
  groupEmails,
  groupTotals,
  editForm,
  appendIds,
  onChangeGroup,
  onSubmitGroup,
  onDeleteGroup,
  onChangeAppendIds,
  onSubmitAppend,
  onToggleRawMime,
  onRemoveEmail,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Group"
      title={group ? group.name : 'Chi tiết group'}
      tone="slate"
      size="xl"
    >
      {group ? (
        <div className="space-y-3">
          <div className="rounded-[1.35rem] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(245,248,247,0.72))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: editForm.color }} />
                  <p className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">{group.name}</p>
                  <Badge tone="neutral">#{group.id}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{group.description || 'Không có mô tả cho group này.'}</p>
              </div>

              <div className="rounded-[1rem] border border-[var(--line)] bg-white/80 px-3 py-2">
                <Checkbox
                  label="Raw MIME"
                  checked={includeRawMime}
                  onChange={(event) => onToggleRawMime(event.target.checked)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">Owner {group.owner?.username || `user:${group.ownerUserId}`}</Badge>
              <Badge tone="accent">{groupTotals.total} emails</Badge>
              <Badge tone="neutral">{registrations.length} register</Badge>
              <Badge tone="neutral">Updated {formatDateTime(group.updatedAt)}</Badge>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <form className="rounded-[1.35rem] border border-[var(--line)] bg-white/74 p-4" onSubmit={onSubmitGroup}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--ink)]">Cấu hình group</p>
                <span className="h-3 w-3 rounded-full" style={{ background: editForm.color }} />
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <Field label="Name">
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    value={editForm.name}
                    onChange={(event) => onChangeGroup((current) => ({ ...current, name: event.target.value }))}
                  />
                </Field>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="submit" size="sm">Lưu group</Button>
                  <Button type="button" size="sm" variant="danger" icon={Trash2} onClick={onDeleteGroup}>
                    Xóa group
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <GroupColorPicker value={editForm.color} onChange={(value) => onChangeGroup((current) => ({ ...current, color: value }))} />
              </div>

              <Field label="Description" className="mt-3">
                <TextArea
                  className={COMPACT_INPUT_CLASS}
                  rows={2}
                  value={editForm.description}
                  onChange={(event) => onChangeGroup((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
            </form>

            <div className="space-y-3 rounded-[1.35rem] border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--ink)]">Mailbox đã register</p>
                <div className="flex items-center gap-2">
                  {loadingRegistrations ? <Badge tone="warning">Đang tải…</Badge> : null}
                  <Badge tone="accent">{registrations.length}</Badge>
                </div>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                {registrations.length ? registrations.map((registration) => (
                  <Badge key={registration.id} tone="neutral">
                    {registration.emailAddress}
                  </Badge>
                )) : (
                  <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/50 px-3 py-2 text-xs text-[var(--muted)]">
                    Chưa có mailbox nào được register.
                  </div>
                )}
                </div>
              </div>

              <div className="grid gap-3 border-t border-[var(--line)] pt-3">
                <form className="space-y-2" onSubmit={onSubmitAppend}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--ink)]">Append IDs</p>
                    <Badge tone="neutral">add</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input className={COMPACT_INPUT_CLASS} value={appendIds} onChange={(event) => onChangeAppendIds(event.target.value)} placeholder="101, 102, 103" />
                    <Button type="submit" size="sm" variant="secondary">Append</Button>
                  </div>
                </form>

                <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/52 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">Destructive</Badge>
                    <p className="text-sm font-bold text-[var(--ink)]">UI không mở replace toàn bộ cho group</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Flow thường ngày chỉ cần append và gỡ từng mail. Full replace vẫn giữ ở API cho script hoặc import batch vì đây là thao tác phá hủy.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[var(--ink)]">Emails trong group</p>
              <div className="flex items-center gap-2">
                {loadingDetail ? <Badge tone="warning">Đang tải…</Badge> : null}
                <Badge tone="accent">{groupTotals.count}/{groupTotals.total}</Badge>
              </div>
            </div>

            {groupEmails.length ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_220px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
                  <p>Mail</p>
                  <p>Sender / Recipient</p>
                  <p className="text-right">Position / Added</p>
                </div>

                <div className="grid gap-0">
                  {groupEmails.map((email) => (
                    <div
                      key={`${email.id}:${email.groupPosition}`}
                      className="grid gap-4 border-b border-[var(--line)] px-4 py-4 last:border-none sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.68fr)_220px] lg:items-center"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ink)]">{truncate(email.subject || '(No Subject)', 96)}</p>
                          <Badge tone="accent">#{email.groupPosition}</Badge>
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
                        <div className="space-y-1 text-left lg:text-right">
                          <Badge tone="neutral" className="hidden lg:inline-flex">{email.domain}</Badge>
                          <div className="flex items-center gap-2 lg:justify-end">
                            <MailOpen className="h-4 w-4 text-[var(--muted)]" />
                            <p className="font-medium">{formatDateTime(email.groupAddedAt)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => onRemoveEmail(email.id)}
                        >
                          Gỡ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] bg-white/58 px-4 py-5 text-sm text-[var(--muted)]">
                Group chưa có email.
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/58 px-5 py-6 text-sm text-[var(--muted)]">
          Đang tải chi tiết group...
        </div>
      )}
    </ModalShell>
  )
}

export default function GroupsView({ token, account }) {
  const [ownerUserId, setOwnerUserId] = useState('')
  const [groups, setGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupEmails, setGroupEmails] = useState([])
  const [groupTotals, setGroupTotals] = useState({ total: 0, count: 0 })
  const [registrations, setRegistrations] = useState([])
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [includeRawMime, setIncludeRawMime] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    color: '#135D66',
    description: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    color: '#135D66',
    description: '',
  })
  const [appendIds, setAppendIds] = useState('')

  async function loadRegistrations(ownerId = selectedGroup?.ownerUserId, { showLoading = true, showError = true } = {}) {
    if (!ownerId && account.isAdmin) {
      setRegistrations([])
      return null
    }

    if (showLoading) {
      setLoadingRegistrations(true)
    }

    try {
      const response = await listEmailRegisters(token, account.isAdmin && ownerId ? { ownerUserId: ownerId } : {})
      setRegistrations(response.registrations)
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

  async function loadGroups(preferredGroupId = selectedGroupId, { showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingGroups(true)
    }

    try {
      const response = await listGroups(token, account.isAdmin && ownerUserId ? { ownerUserId } : {})
      setGroups(response.groups)

      if (!response.groups.length) {
        setSelectedGroupId(null)
        setSelectedGroup(null)
        setGroupEmails([])
        setGroupTotals({ total: 0, count: 0 })
        setRegistrations([])
        return
      }

      if (preferredGroupId && response.groups.some((group) => group.id === preferredGroupId)) {
        setSelectedGroupId(preferredGroupId)
      } else if (preferredGroupId) {
        setSelectedGroupId(null)
        setSelectedGroup(null)
        setGroupEmails([])
        setGroupTotals({ total: 0, count: 0 })
        setRegistrations([])
      }
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    } finally {
      setLoadingGroups(false)
    }
  }

  async function loadGroupDetail(groupId = selectedGroupId, { showLoading = true, showError = true } = {}) {
    if (!groupId) {
      return null
    }

    if (showLoading) {
      setLoadingDetail(true)
    }

    try {
      const groupResponse = await getGroup(token, groupId)
      const [emailsResponse] = await Promise.all([
        getGroupEmails(token, groupId, {
          limit: 200,
          offset: 0,
          includeRawMime,
        }).catch(async (error) => {
          if (error.status === 409) {
            if (showError) {
              toast('Group có email denied/missing, backend đã tự prune. Đang tải lại.')
            }

            return getGroupEmails(token, groupId, {
              limit: 200,
              offset: 0,
              includeRawMime,
            })
          }

          throw error
        }),
        loadRegistrations(groupResponse.group.ownerUserId, {
          showLoading,
          showError,
        }),
      ])

      setSelectedGroup(groupResponse.group)
      setEditForm({
        name: groupResponse.group.name,
        color: groupResponse.group.color,
        description: groupResponse.group.description,
      })
      setGroupEmails(emailsResponse.emails)
      setGroupTotals({
        total: emailsResponse.total,
        count: emailsResponse.count,
      })
      return groupResponse
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
    void loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!account.isAdmin) {
      return
    }

    void loadGroups(null, {
      showLoading: false,
      showError: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.isAdmin, ownerUserId])

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroup(null)
      setGroupEmails([])
      setGroupTotals({ total: 0, count: 0 })
      setRegistrations([])
      return
    }

    void loadGroupDetail(selectedGroupId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedGroupId, includeRawMime])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadGroups(selectedGroupId, {
        showLoading: false,
        showError: false,
      })

      if (selectedGroupId) {
        void loadGroupDetail(selectedGroupId, {
          showLoading: false,
          showError: false,
        })
      }
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedGroupId, includeRawMime, ownerUserId])

  async function handleCreate(event) {
    event.preventDefault()

    try {
      const response = await createGroup(token, createForm)
      toast.success('Đã tạo group')
      setCreateForm({
        name: '',
        color: '#135D66',
        description: '',
      })
      setCreateModalOpen(false)
      await loadGroups(response.group.id)
      await loadGroupDetail(response.group.id, {
        showLoading: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()

    if (!selectedGroupId) {
      return
    }

    try {
      await updateGroup(token, selectedGroupId, editForm)
      toast.success('Đã cập nhật group')
      await loadGroups(selectedGroupId)
      await loadGroupDetail(selectedGroupId, {
        showLoading: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleDelete() {
    if (!selectedGroupId) {
      return
    }

    try {
      await deleteGroup(token, selectedGroupId)
      toast.success('Đã xóa group')
      await loadGroups()
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleAppend(event) {
    event.preventDefault()

    if (!selectedGroupId) {
      return
    }

    const emailIds = parseIdList(appendIds)
    if (!emailIds.length) {
      toast.error('Nhập ít nhất một email ID')
      return
    }

    try {
      await addGroupEmails(token, selectedGroupId, { emailIds })
      setAppendIds('')
      toast.success('Đã append email IDs')
      await loadGroups(selectedGroupId)
      await loadGroupDetail(selectedGroupId, {
        showLoading: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  async function handleRemoveEmail(emailId) {
    if (!selectedGroupId) {
      return
    }

    try {
      await removeGroupEmail(token, selectedGroupId, emailId)
      toast.success('Đã gỡ email khỏi group')
      await loadGroups(selectedGroupId)
      await loadGroupDetail(selectedGroupId, {
        showLoading: false,
      })
    } catch (error) {
      toast.error(formatApiError(error))
    }
  }

  return (
    <div className="space-y-5">
      <Panel tone="ocean" className="p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Group toolbar</p>
              <Badge tone="accent">Auto refresh 10s</Badge>
              <Badge tone="neutral">{groups.length} groups</Badge>
              {loadingGroups ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
            </div>
            <Button size="sm" icon={Plus} onClick={() => setCreateModalOpen(true)}>
              Tạo group
            </Button>
          </div>

          {account.isAdmin ? (
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/68 p-3 sm:max-w-[240px]">
              <Field label="ownerUserId">
                <Input
                  className={COMPACT_INPUT_CLASS}
                  value={ownerUserId}
                  onChange={(event) => setOwnerUserId(event.target.value)}
                  placeholder="Filter owner"
                />
              </Field>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        eyebrow="Groups"
        title="Danh sách group"
        tone="ocean"
        action={<Badge tone="accent">{groups.length} rows</Badge>}
      >
        {groups.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(240px,0.8fr)_200px] items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:grid">
              <p>Group</p>
              <p>Owner / Scope</p>
              <p className="text-right">Updated</p>
            </div>

            <div className="grid gap-0">
              {groups.map((group) => (
                <GroupListItem
                  key={group.id}
                  group={group}
                  active={selectedGroupId === group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có group</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tạo group đầu tiên để gom các email ID đã được register.</p>
          </div>
        )}
      </Panel>

      <GroupCreateModal
        open={createModalOpen}
        form={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => setCreateModalOpen(false)}
      />

      <GroupDetailModal
        open={Boolean(selectedGroupId)}
        group={selectedGroup}
        registrations={registrations}
        loadingRegistrations={loadingRegistrations}
        loadingDetail={loadingDetail}
        includeRawMime={includeRawMime}
        groupEmails={groupEmails}
        groupTotals={groupTotals}
        editForm={editForm}
        appendIds={appendIds}
        onChangeGroup={setEditForm}
        onSubmitGroup={handleUpdate}
        onDeleteGroup={handleDelete}
        onChangeAppendIds={setAppendIds}
        onSubmitAppend={handleAppend}
        onToggleRawMime={setIncludeRawMime}
        onRemoveEmail={handleRemoveEmail}
        onClose={() => {
          setSelectedGroupId(null)
          setSelectedGroup(null)
          setGroupEmails([])
          setGroupTotals({ total: 0, count: 0 })
          setRegistrations([])
        }}
      />
    </div>
  )
}
