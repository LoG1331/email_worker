import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { cn, findIssueMessage, formatApiError, formatDateTime, truncate } from '../lib/format.js'
import { clampOffset } from '../lib/pagination.js'
import { AutoRefreshButton, Badge, Button, Checkbox, CompactPagination, CursorPagination, Field, FormError, Input, ModalShell, Panel, TextArea } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'
import { useCursorPager } from '../hooks/useCursorPager.js'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'
const GROUP_SURFACE_CLASS = 'rounded-[1.25rem] border border-[var(--line)] bg-white/78'

function GroupColorPicker({ value, onChange }) {
  return (
    <Field label="Màu">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-[1rem] border border-[var(--line)] bg-white/88 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-10 cursor-pointer rounded-[0.8rem] border border-white/80 bg-transparent p-0.5"
            aria-label="Chọn màu nhóm"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Hiện tại</p>
            <p className="text-sm font-semibold tracking-[0.02em] text-[var(--ink)]">{value}</p>
          </div>
        </label>
      </div>
    </Field>
  )
}

function parseEmailAddressList(value) {
  return [...new Set(
    String(value || '')
      .split(/[\s,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )]
}

function GroupCreateModal({ open, form, saving, error, onChange, onSubmit, onClose }) {
  const nameError = findIssueMessage(error, 'name')

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Group"
      title="Tạo nhóm mới"
      tone="sand"
      size="md"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormError error={error} handledFields={['name', 'color', 'description']} />
        <Field label="Tên nhóm" error={nameError}>
          <Input className={COMPACT_INPUT_CLASS} invalid={Boolean(nameError)} value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <GroupColorPicker value={form.color} onChange={(value) => onChange((current) => ({ ...current, color: value }))} />
        <Field label="Mô tả" error={findIssueMessage(error, 'description')}>
          <TextArea className={COMPACT_INPUT_CLASS} rows={3} value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" icon={Plus} loading={saving}>Tạo nhóm</Button>
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

  return name || address || 'Không rõ người gửi'
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
        'w-full border-b border-[var(--line)] px-4 py-4 text-left transition-colors last:border-none sm:px-5',
        active
          ? 'bg-[linear-gradient(135deg,rgba(19,93,102,0.12),rgba(32,130,141,0.06))]'
          : 'bg-transparent hover:bg-[rgba(19,93,102,0.05)]',
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.72)]" style={{ background: group.color }} />
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">{group.name}</p>
              <Badge tone="accent">{group.emailCount} mail</Badge>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{truncate(group.description || 'Không có mô tả', 180)}</p>
          </div>

          <div className="hidden shrink-0 text-right lg:block">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Cập nhật</p>
            <p className="mt-1 text-sm font-medium text-[var(--ink)]">{formatDateTime(group.updatedAt)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-[var(--muted)]">
          <Badge tone="neutral">#{group.id}</Badge>
          <span className="lg:hidden">Cập nhật {formatDateTime(group.updatedAt)}</span>
          <span className="hidden lg:inline text-[var(--muted)]/70">Màu {group.color}</span>
        </div>
      </div>
    </button>
  )
}

function RegistrationChip({ registration }) {
  return (
    <div className="rounded-[0.95rem] border border-[var(--line)] bg-white/88 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <p className="truncate text-sm font-semibold text-[var(--ink)]">{registration.emailAddress}</p>
    </div>
  )
}

function GroupEmailRow({ email, onRemoveEmail }) {
  return (
    <div className="border-b border-[var(--line)] px-4 py-4 last:border-none sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-[-0.01em] text-[var(--ink)] sm:text-[15px]">
              {truncate(email.subject || '(No Subject)', 108)}
            </p>
            <Badge tone="accent">#{email.groupPosition}</Badge>
            <Badge tone="neutral">{email.domain}</Badge>
            <Badge tone="neutral">email #{email.id}</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{getEmailPreview(email)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={Trash2}
          className="shrink-0"
          onClick={() => onRemoveEmail(email.id)}
        >
          Xóa khỏi nhóm
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="min-w-0 text-[var(--ink)]">
          <span className="font-semibold text-[var(--muted)]">Từ</span>
          <span className="ml-2 truncate">{getSenderLabel(email)}</span>
        </p>
        <p className="min-w-0 text-[var(--ink)]">
          <span className="font-semibold text-[var(--muted)]">Đến</span>
          <span className="ml-2 truncate">{email.to}</span>
        </p>
        <p className="text-[var(--muted)]">Thêm lúc {formatDateTime(email.groupAddedAt)}</p>
      </div>
    </div>
  )
}

function GroupDetailModal({
  open,
  group,
  registrations,
  registrationTotal,
  registrationOffset,
  registrationLimit,
  loadingRegistrations,
  loadingDetail,
  includeRawMime,
  groupEmails,
  groupCount,
  groupHasMore,
  groupPage,
  groupHasPrev,
  editForm,
  appendMailboxes,
  editError,
  appendError,
  onChangeGroup,
  onSubmitGroup,
  onDeleteGroup,
  onChangeAppendMailboxes,
  onSubmitAppend,
  onToggleRawMime,
  onRemoveEmail,
  onPrevRegistrations,
  onNextRegistrations,
  onChangeRegistrationLimit,
  onPrevEmails,
  onNextEmails,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Group"
      title={group ? group.name : 'Chi tiết nhóm'}
      tone="slate"
      size="xl"
    >
      {group ? (
        <div className="space-y-4">
          <div className="rounded-[1.45rem] border border-[var(--line)] bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(243,247,246,0.82))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.85)]" style={{ background: editForm.color }} />
                  <p className="truncate text-lg font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-[1.35rem]">{group.name}</p>
                  <Badge tone="neutral">#{group.id}</Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {group.description || 'Nhóm này đang dùng làm feed hộp thư riêng cho người sở hữu hiện tại.'}
                </p>
              </div>

              <div className="rounded-[0.95rem] border border-[var(--line)] bg-white/82 px-3 py-2">
                <Checkbox
                  label="MIME gốc"
                  checked={includeRawMime}
                  onChange={(event) => onToggleRawMime(event.target.checked)}
                  className="gap-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="accent">{group.emailCount} email</Badge>
              <Badge tone="neutral">{registrations.length} hộp thư</Badge>
              <Badge tone="neutral">{group.color}</Badge>
              <Badge tone="neutral">Cập nhật {formatDateTime(group.updatedAt)}</Badge>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <form className={cn(GROUP_SURFACE_CLASS, 'p-4 sm:p-5')} onSubmit={onSubmitGroup}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Cấu hình</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Chỉnh tên, màu và mô tả hiển thị của nhóm.</p>
                </div>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: editForm.color }} />
              </div>

              <div className="grid gap-3">
                <FormError error={editError} handledFields={['name', 'color', 'description']} />
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <Field label="Tên nhóm" error={findIssueMessage(editError, 'name')}>
                    <Input
                      className={COMPACT_INPUT_CLASS}
                      value={editForm.name}
                      invalid={Boolean(findIssueMessage(editError, 'name'))}
                      onChange={(event) => onChangeGroup((current) => ({ ...current, name: event.target.value }))}
                    />
                  </Field>
                  <GroupColorPicker value={editForm.color} onChange={(value) => onChangeGroup((current) => ({ ...current, color: value }))} />
                </div>

                <Field label="Mô tả">
                  <TextArea
                    className={COMPACT_INPUT_CLASS}
                    rows={4}
                    value={editForm.description}
                    onChange={(event) => onChangeGroup((current) => ({ ...current, description: event.target.value }))}
                  />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" size="sm">Lưu nhóm</Button>
                <Button type="button" size="sm" variant="danger" icon={Trash2} onClick={onDeleteGroup}>
                  Xóa nhóm
                </Button>
              </div>
            </form>

            <section className={cn(GROUP_SURFACE_CLASS, 'p-4 sm:p-5')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Hộp thư đã đăng ký</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Danh sách hộp thư bạn đã đăng ký và có thể thêm vào nhóm.</p>
                </div>
                <div className="flex items-center gap-2">
                  {loadingRegistrations ? <Badge tone="warning">Đang tải…</Badge> : null}
                  <Badge tone="accent">{registrations.length}</Badge>
                  <CompactPagination
                    total={registrationTotal}
                    count={registrations.length}
                    offset={registrationOffset}
                    limit={registrationLimit}
                    onLimitChange={onChangeRegistrationLimit}
                    onPrev={onPrevRegistrations}
                    onNext={onNextRegistrations}
                    limitOptions={[25, 50, 100, 200]}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {registrations.length ? registrations.map((registration) => (
                  <RegistrationChip key={registration.id} registration={registration} />
                )) : (
                  <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/52 px-3 py-3 text-sm text-[var(--muted)]">
                    Chưa có hộp thư nào được đăng ký.
                  </div>
                )}
              </div>

              <form className="mt-4 border-t border-[var(--line)] pt-4" onSubmit={onSubmitAppend}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">Thêm hộp thư</p>
                  <Badge tone="neutral">tự đăng ký</Badge>
                </div>

                <div className="mt-3 grid gap-2">
                  <Input
                    className={COMPACT_INPUT_CLASS}
                    value={appendMailboxes}
                    invalid={Boolean(appendError)}
                    onChange={(event) => onChangeAppendMailboxes(event.target.value)}
                    placeholder="alice@example.com, bob@example.com"
                  />
                  <FormError error={appendError} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" variant="secondary">Thêm vào nhóm</Button>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  Hộp thư chưa đăng ký sẽ được backend tự tạo cho người sở hữu hiện tại. Nếu hộp thư đã thuộc người dùng khác thì yêu cầu sẽ bị từ chối.
                </p>
              </form>
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">Email trong nhóm</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Danh sách email hiện đang được lưu trong nhóm, mỗi dòng có thể xóa trực tiếp.</p>
              </div>
              <div className="flex items-center gap-2">
                {loadingDetail ? <Badge tone="warning">Đang tải…</Badge> : null}
                <Badge tone="accent">{groupCount} dòng</Badge>
                <CursorPagination
                  page={groupPage}
                  count={groupCount}
                  hasPrev={groupHasPrev}
                  hasNext={groupHasMore}
                  onPrev={onPrevEmails}
                  onNext={onNextEmails}
                />
              </div>
            </div>

            {groupEmails.length ? (
              <div className="overflow-hidden rounded-[1.45rem] border border-[var(--line)] bg-white/72">
                {groupEmails.map((email) => (
                  <GroupEmailRow
                    key={`${email.id}:${email.groupPosition}`}
                    email={email}
                    onRemoveEmail={onRemoveEmail}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] bg-white/58 px-4 py-5 text-sm text-[var(--muted)]">
                Nhóm chưa có email nào.
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/58 px-5 py-6 text-sm text-[var(--muted)]">
          Đang tải thông tin nhóm...
        </div>
      )}
    </ModalShell>
  )
}

export default function GroupsView({ token }) {
  const [groups, setGroups] = useState([])
  const [totalGroups, setTotalGroups] = useState(0)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupEmails, setGroupEmails] = useState([])
  const [groupEmailState, setGroupEmailState] = useState({ count: 0, hasMore: false })
  const [registrations, setRegistrations] = useState([])
  const [totalRegistrations, setTotalRegistrations] = useState(0)
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
  const [appendMailboxes, setAppendMailboxes] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [editError, setEditError] = useState(null)
  const [appendError, setAppendError] = useState(null)
  const [groupListFilters, setGroupListFilters] = useState({
    limit: 50,
    offset: 0,
  })
  const [registrationFilters, setRegistrationFilters] = useState({
    limit: 50,
    offset: 0,
  })
  const groupEmailLimit = 50
  const groupEmailPager = useCursorPager()

  async function loadRegistrations(query = registrationFilters, { showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingRegistrations(true)
    }

    try {
      const response = await listEmailRegisters(token, query)
      if (!response.registrations.length && query.offset > 0 && response.total <= query.offset) {
        setRegistrationFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }
      setRegistrations(response.registrations)
      setTotalRegistrations(response.total)
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

  async function loadGroups(preferredGroupId = selectedGroupId, query = groupListFilters, { showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoadingGroups(true)
    }

    try {
      const response = await listGroups(token, query)
      if (!response.groups.length && query.offset > 0 && response.total <= query.offset) {
        setGroupListFilters((current) => ({
          ...current,
          offset: clampOffset(current.offset, response.total, current.limit),
        }))
      }

      setGroups(response.groups)
      setTotalGroups(response.total)

      if (!response.groups.length) {
        setSelectedGroupId(null)
        setSelectedGroup(null)
        setGroupEmails([])
        setGroupEmailState({ count: 0, hasMore: false })
        setRegistrations([])
        setTotalRegistrations(0)
        return
      }

      if (preferredGroupId && response.groups.some((group) => group.id === preferredGroupId)) {
        setSelectedGroupId(preferredGroupId)
      } else if (preferredGroupId) {
        setSelectedGroupId(null)
        setSelectedGroup(null)
        setGroupEmails([])
        setGroupEmailState({ count: 0, hasMore: false })
        setRegistrations([])
        setTotalRegistrations(0)
      }
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
    } finally {
      setLoadingGroups(false)
    }
  }

  async function loadGroupDetail(groupId = selectedGroupId, query = { limit: groupEmailLimit }, { showLoading = true, showError = true } = {}) {
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
          limit: query.limit,
          cursor: groupEmailPager.cursor,
          includeRawMime,
        }).catch(async (error) => {
          if (error.status === 409) {
            if (showError) {
              toast('Group có email denied/missing, backend đã tự prune. Đang tải lại.')
            }

            return getGroupEmails(token, groupId, {
              limit: query.limit,
              cursor: groupEmailPager.cursor,
              includeRawMime,
            })
          }

          throw error
        }),
        loadRegistrations(registrationFilters, {
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
      groupEmailPager.sync(emailsResponse)
      setGroupEmails(emailsResponse.emails)
      setGroupEmailState({
        count: emailsResponse.count,
        hasMore: emailsResponse.hasMore,
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
  }, [groupListFilters.limit, groupListFilters.offset, token])

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroup(null)
      setGroupEmails([])
      setGroupEmailState({ count: 0, hasMore: false })
      setRegistrations([])
      setTotalRegistrations(0)
      return
    }

    void loadGroupDetail(selectedGroupId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupEmailLimit, groupEmailPager.cursor, includeRawMime, registrationFilters.limit, registrationFilters.offset, selectedGroupId, token])

  const refreshNow = useAutoRefresh(async () => {
    await loadGroups(selectedGroupId, groupListFilters, {
      showLoading: false,
      showError: false,
    })

    if (selectedGroupId) {
      await loadGroupDetail(selectedGroupId, { limit: groupEmailLimit }, {
        showLoading: false,
        showError: false,
      })
    }
  }, 10000)

  async function handleCreate(event) {
    event.preventDefault()
    setCreatingGroup(true)
    setCreateError(null)

    try {
      const response = await createGroup(token, createForm)
      toast.success('Đã tạo nhóm')
      setCreateForm({
        name: '',
        color: '#135D66',
        description: '',
      })
      setCreateModalOpen(false)
      setGroupListFilters((current) => ({ ...current, offset: 0 }))
      groupEmailPager.reset()
      await loadGroups(response.group.id, { ...groupListFilters, offset: 0 })
      await loadGroupDetail(response.group.id, { limit: groupEmailLimit }, {
        showLoading: false,
      })
    } catch (error) {
      setCreateError(error)
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()

    if (!selectedGroupId) {
      return
    }

    setEditError(null)

    try {
      await updateGroup(token, selectedGroupId, editForm)
      toast.success('Đã cập nhật nhóm')
      await loadGroups(selectedGroupId, groupListFilters)
      await loadGroupDetail(selectedGroupId, { limit: groupEmailLimit }, {
        showLoading: false,
      })
    } catch (error) {
      setEditError(error)
    }
  }

  async function handleDelete() {
    if (!selectedGroupId) {
      return
    }

    setEditError(null)

    try {
      await deleteGroup(token, selectedGroupId)
      toast.success('Đã xóa nhóm')
      await loadGroups(null, groupListFilters)
    } catch (error) {
      setEditError(error)
    }
  }

  async function handleAppend(event) {
    event.preventDefault()

    if (!selectedGroupId) {
      return
    }

    setAppendError(null)

    const emailAddresses = parseEmailAddressList(appendMailboxes)
    if (!emailAddresses.length) {
      setAppendError(new Error('Nhập ít nhất một hộp thư'))
      return
    }

    try {
      await addGroupEmails(token, selectedGroupId, { emailAddresses })
      setAppendMailboxes('')
      toast.success('Đã thêm hộp thư vào nhóm')
      groupEmailPager.reset()
      await loadGroups(selectedGroupId, groupListFilters)
      await loadGroupDetail(selectedGroupId, { limit: groupEmailLimit }, {
        showLoading: false,
      })
    } catch (error) {
      setAppendError(error)
    }
  }

  async function handleRemoveEmail(emailId) {
    if (!selectedGroupId) {
      return
    }

    const shouldStepBack = groupEmails.length === 1 && groupEmailPager.hasPrev

    try {
      await removeGroupEmail(token, selectedGroupId, emailId)
      toast.success('Đã gỡ email khỏi nhóm')
      await loadGroups(selectedGroupId, groupListFilters)
      if (shouldStepBack) {
        groupEmailPager.goPrev()
        return
      }

      await loadGroupDetail(selectedGroupId, { limit: groupEmailLimit }, {
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
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent)]">Nhóm mail</p>
              <AutoRefreshButton onClick={refreshNow} />
              <Badge tone="neutral">{groups.length} / {totalGroups} nhóm</Badge>
              {loadingGroups ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" icon={Plus} onClick={() => setCreateModalOpen(true)}>
                Tạo nhóm
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Nhóm"
        title="Danh sách nhóm"
        tone="ocean"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{groups.length} dòng</Badge>
            <CompactPagination
              total={totalGroups}
              count={groups.length}
              offset={groupListFilters.offset}
              limit={groupListFilters.limit}
              onLimitChange={(limit) => setGroupListFilters((current) => ({ ...current, limit, offset: 0 }))}
              onPrev={() => setGroupListFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
              onNext={() => setGroupListFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            />
          </div>
        )}
      >
        {groups.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/65">
            <div className="hidden items-center gap-4 border-b border-[var(--line)] bg-[rgba(29,42,42,0.04)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)] lg:flex">
              <p className="flex-1">Nhóm mail</p>
              <p className="w-[180px] text-right">Cập nhật</p>
            </div>

            <div className="grid gap-0">
              {groups.map((group) => (
                <GroupListItem
                  key={group.id}
                  group={group}
                  active={selectedGroupId === group.id}
                  onClick={() => {
                    groupEmailPager.reset()
                    setSelectedGroupId(group.id)
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/50 px-6 py-12 text-center">
            <p className="font-display text-2xl text-[var(--ink)]">Chưa có nhóm nào</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tạo nhóm đầu tiên để gom các email ID đã đăng ký.</p>
          </div>
        )}
      </Panel>

      <GroupCreateModal
        open={createModalOpen}
        form={createForm}
        saving={creatingGroup}
        error={createError}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => {
          setCreateModalOpen(false)
          setCreateError(null)
        }}
      />

      <GroupDetailModal
        open={Boolean(selectedGroupId)}
        group={selectedGroup}
        registrations={registrations}
        registrationTotal={totalRegistrations}
        registrationOffset={registrationFilters.offset}
        registrationLimit={registrationFilters.limit}
        loadingRegistrations={loadingRegistrations}
        loadingDetail={loadingDetail}
        includeRawMime={includeRawMime}
        groupEmails={groupEmails}
        groupCount={groupEmailState.count}
        groupHasMore={groupEmailState.hasMore}
        groupPage={groupEmailPager.page}
        groupHasPrev={groupEmailPager.hasPrev}
        editForm={editForm}
        appendMailboxes={appendMailboxes}
        editError={editError}
        appendError={appendError}
        onChangeGroup={setEditForm}
        onSubmitGroup={handleUpdate}
        onDeleteGroup={handleDelete}
        onChangeAppendMailboxes={setAppendMailboxes}
        onSubmitAppend={handleAppend}
        onToggleRawMime={setIncludeRawMime}
        onRemoveEmail={handleRemoveEmail}
        onPrevRegistrations={() => setRegistrationFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
        onNextRegistrations={() => setRegistrationFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
        onChangeRegistrationLimit={(limit) => setRegistrationFilters((current) => ({ ...current, limit, offset: 0 }))}
        onPrevEmails={groupEmailPager.goPrev}
        onNextEmails={groupEmailPager.goNext}
        onClose={() => {
          setSelectedGroupId(null)
          setSelectedGroup(null)
          setGroupEmails([])
          setGroupEmailState({ count: 0, hasMore: false })
          setRegistrations([])
          setTotalRegistrations(0)
          setEditError(null)
          setAppendError(null)
          groupEmailPager.reset()
        }}
      />
    </div>
  )
}
