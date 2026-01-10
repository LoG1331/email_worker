import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Mail as MailIcon, User, Send, X, RefreshCw, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import EmailDetailModal from '../modals/EmailDetailModal'

const PRESET_COLORS = [
    '#c5532d', // Terracotta
    '#1f6a5c', // Teal
    '#d59b46', // Amber
    '#7d4e3c', // Cocoa
    '#2f6f91', // Slate blue
    '#b63b3b', // Brick red
    '#8a7a6d', // Taupe
]

export default function GroupsTab({ apiKey, activeTab }) {
    const [groups, setGroups] = useState([])
    const [selectedGroup, setSelectedGroup] = useState(null)
    const [addresses, setAddresses] = useState([])  // Email addresses in group
    const [emails, setEmails] = useState([])        // Actual emails received
    const [selectedEmail, setSelectedEmail] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0])
    const [showAddEmailModal, setShowAddEmailModal] = useState(false)
    const [newEmailAddress, setNewEmailAddress] = useState('')
    const [polling, setPolling] = useState(false)
    const [pollInterval, setPollInterval] = useState(30000)

    useEffect(() => {
        if (apiKey && activeTab === 'starred') {
            loadGroups()
        }
    }, [apiKey, activeTab])

    useEffect(() => {
        if (selectedGroup) {
            loadGroupEmails(selectedGroup.id)
        }
    }, [selectedGroup])

    // Auto reload emails inside a group
    useEffect(() => {
        if (!apiKey || !selectedGroup || !polling || pollInterval <= 0) return
        const id = setInterval(() => {
            loadGroupEmails(selectedGroup.id)
        }, pollInterval)
        return () => clearInterval(id)
    }, [apiKey, selectedGroup, polling, pollInterval])

    const loadGroups = async () => {
        try {
            const response = await fetch('/api/groups', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setGroups(data.groups || [])
            }
        } catch {
            toast.error('Lỗi tải nhóm')
        }
    }

    const loadGroupEmails = async (groupId) => {
        setLoading(true)
        try {
            const response = await fetch(`/api/groups/${groupId}/emails`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setAddresses(data.addresses || [])
                setEmails(data.emails || [])
            }
        } catch {
            toast.error('Lỗi tải email')
        } finally {
            setLoading(false)
        }
    }

    const createGroup = async () => {
        if (!newGroupName.trim()) {
            toast.error('Vui lòng nhập tên nhóm')
            return
        }

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newGroupName, color: newGroupColor })
            })
            if (response.ok) {
                toast.success('Đã tạo nhóm')
                setNewGroupName('')
                setNewGroupColor(PRESET_COLORS[0])
                setShowCreateModal(false)
                loadGroups()
            } else {
                const data = await response.json()
                toast.error(data.error || 'Lỗi tạo nhóm')
            }
        } catch {
            toast.error('Lỗi kết nối')
        }
    }

    const deleteGroup = async (groupId) => {
        if (!confirm('Bạn có chắc muốn xóa nhóm này?')) return

        try {
            await fetch(`/api/groups/${groupId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            toast.success('Đã xóa nhóm')
            if (selectedGroup?.id === groupId) {
                setSelectedGroup(null)
                setEmails([])
                setAddresses([])
            }
            loadGroups()
        } catch {
            toast.error('Lỗi xóa nhóm')
        }
    }

    const openEditModal = (group, e) => {
        e.stopPropagation()
        setEditingGroup(group)
        setNewGroupName(group.name)
        setNewGroupColor(group.color)
        setShowEditModal(true)
    }

    const updateGroup = async () => {
        if (!newGroupName.trim()) {
            toast.error('Vui lòng nhập tên nhóm')
            return
        }

        try {
            const response = await fetch(`/api/groups/${editingGroup.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newGroupName, color: newGroupColor })
            })
            if (response.ok) {
                toast.success('Đã cập nhật nhóm')
                setShowEditModal(false)
                setEditingGroup(null)
                loadGroups()
                // Update selectedGroup if it was the one edited
                if (selectedGroup?.id === editingGroup.id) {
                    setSelectedGroup({ ...selectedGroup, name: newGroupName, color: newGroupColor })
                }
            } else {
                const data = await response.json()
                toast.error(data.error || 'Lỗi cập nhật nhóm')
            }
        } catch {
            toast.error('Lỗi kết nối')
        }
    }

    const addEmailToGroup = async () => {
        if (!newEmailAddress.trim()) {
            toast.error('Vui lòng nhập địa chỉ email')
            return
        }

        // Split by newlines and filter empty lines
        const lines = newEmailAddress.split('\n').map(line => line.trim()).filter(line => line.length > 0)

        if (lines.length === 0) {
            toast.error('Vui lòng nhập địa chỉ email')
            return
        }

        // Validate each email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const invalidEmails = []

        lines.forEach((email, index) => {
            if (!emailRegex.test(email)) {
                invalidEmails.push({ line: index + 1, email })
            }
        })

        if (invalidEmails.length > 0) {
            const errorMessages = invalidEmails.map(e => `Dòng ${e.line}: "${e.email}"`).join(', ')
            toast.error(`Email không hợp lệ: ${errorMessages}`)
            return
        }

        // Add all emails
        let successCount = 0
        let failCount = 0
        const errors = []

        for (const email of lines) {
            try {
                const response = await fetch(`/api/groups/${selectedGroup.id}/emails`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ emailAddress: email })
                })
                if (response.ok) {
                    successCount++
                } else {
                    const data = await response.json()
                    failCount++
                    errors.push(`${email}: ${data.error || 'Lỗi'}`)
                }
            } catch {
                failCount++
                errors.push(`${email}: Lỗi kết nối`)
            }
        }

        if (successCount > 0) {
            toast.success(`Đã thêm ${successCount} email vào nhóm`)
            loadGroupEmails(selectedGroup.id)
            loadGroups() // Refresh count
        }

        if (failCount > 0) {
            toast.error(`Lỗi ${failCount} email: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`)
        }

        if (successCount > 0 || failCount === lines.length) {
            setNewEmailAddress('')
            setShowAddEmailModal(false)
        }
    }

    const removeEmailFromGroup = async (emailAddress) => {
        try {
            await fetch(`/api/groups/${selectedGroup.id}/emails/${encodeURIComponent(emailAddress)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            toast.success('Đã xóa email khỏi nhóm')
            loadGroupEmails(selectedGroup.id)
            loadGroups() // Refresh count
        } catch {
            toast.error('Lỗi xóa email')
        }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
            {/* Header & controls */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-3xl font-black text-[#2a1f1a] font-display">Quản lý Nhóm Email</h2>
                    <p className="text-sm text-[#6b5b52] mt-1">Sắp xếp nhóm rõ ràng, chi tiết địa chỉ và email nhận.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            loadGroups()
                            if (selectedGroup) loadGroupEmails(selectedGroup.id)
                        }}
                        className="btn-secondary h-12 px-5 flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Làm mới
                    </button>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#6b5b52] bg-[#fffdf8] border border-[#ead8c5] rounded-xl px-3 py-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={polling}
                                onChange={(e) => {
                                    const checked = e.target.checked
                                    setPolling(checked)
                                    if (checked && pollInterval === 0) setPollInterval(30000)
                                }}
                                className="w-4 h-4 rounded border-[#cdb8a3] text-[#c5532d] focus:ring-2 focus:ring-[#d59b46]/40"
                            />
                            Auto reload nhóm
                        </label>
                        <select
                            value={pollInterval}
                            onChange={(e) => setPollInterval(Number(e.target.value))}
                            className="bg-transparent border-none text-[#2a1f1a] text-xs font-bold focus:outline-none"
                            disabled={!polling}
                        >
                            <option value={15000}>15s</option>
                            <option value={30000}>30s</option>
                            <option value={60000}>1 phút</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary h-12 px-6 flex items-center gap-3"
                    >
                        <Plus size={18} />
                        Tạo nhóm mới
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Số nhóm', value: groups.length },
                    { label: 'Email trong nhóm đã chọn', value: selectedGroup ? addresses.length : 0 },
                    { label: 'Tổng địa chỉ trong tất cả nhóm', value: groups.reduce((s, g) => s + (g.emailCount || 0), 0) }
                ].map((stat, i) => (
                    <div key={i} className="surface-panel rounded-2xl p-4 flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-[#9c8573]">{stat.label}</span>
                        <span className="text-3xl font-black font-display text-[#2a1f1a]">{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
                {/* Sidebar: group list */}
                <div className="surface-panel rounded-3xl p-4 flex flex-col gap-3 max-h-[70vh] lg:sticky lg:top-6">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase tracking-widest text-[#9c8573]">Danh sách nhóm</span>
                        <span className="text-xs font-bold text-[#6b5b52]">{groups.length} nhóm</span>
                    </div>
                    <div className="space-y-2 overflow-auto pr-1">
                        {groups.map(group => {
                            const isActive = selectedGroup?.id === group.id
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group)}
                                    className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                                        isActive
                                            ? 'border-[#c5532d] bg-[#fff8ef] shadow-sm'
                                            : 'border-[#ead8c5] hover:border-[#d59b46] bg-[#f9efe3]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-black text-[#2a1f1a] truncate font-display">{group.name}</div>
                                            <div className="text-xs font-bold text-[#9c8573]">{group.emailCount} địa chỉ</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => openEditModal(group, e)}
                                            className="w-8 h-8 rounded-lg bg-[#f1e3d4] hover:bg-[#f6ecdf] text-[#9c8573] hover:text-[#c5532d] flex items-center justify-center transition-colors"
                                            title="Chỉnh sửa nhóm"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteGroup(group.id)
                                            }}
                                            className="w-8 h-8 rounded-lg bg-[#f1e3d4] hover:bg-[#f6dede] text-[#9c8573] hover:text-[#b63b3b] flex items-center justify-center transition-colors"
                                            title="Xóa nhóm"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </button>
                            )
                        })}

                        {groups.length === 0 && (
                            <div className="surface-soft py-16 rounded-2xl text-center px-4">
                                <MailIcon size={48} className="mx-auto text-[#e2cdb5] mb-4" />
                                <p className="text-[#9c8573] font-bold text-sm">Chưa có nhóm nào</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail panel */}
                <div className="surface-panel rounded-3xl p-6 space-y-6 min-h-[70vh]">
                    {!selectedGroup ? (
                        <div className="surface-soft rounded-2xl p-10 text-center">
                            <p className="text-[#9c8573] font-bold">Chọn một nhóm bên trái để xem chi tiết.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: selectedGroup.color }} />
                                    <div>
                                        <div className="text-2xl font-black text-[#2a1f1a] font-display">{selectedGroup.name}</div>
                                        <div className="text-sm font-bold text-[#9c8573]">{addresses.length} địa chỉ • {emails.length} email hiển thị</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddEmailModal(true)}
                                    className="btn-secondary h-11 px-6 flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Thêm địa chỉ email
                                </button>
                            </div>

                            {/* Addresses */}
                            <div className="rounded-2xl border border-[#ead8c5] p-5 bg-[#f8efe4] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-black text-[#6b5b52] uppercase tracking-widest">
                                        Địa chỉ email ({addresses.length})
                                    </div>
                                    {addresses.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const emailList = addresses.map(a => a.emailAddress).join('\n')
                                                navigator.clipboard.writeText(emailList)
                                                toast.success(`Đã copy ${addresses.length} địa chỉ email`)
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#6b5b52] hover:text-[#c5532d] bg-[#fff8ef] hover:bg-[#f6ecdf] rounded-lg border border-[#ead8c5] hover:border-[#e2c8a9] transition-colors"
                                        >
                                            <Copy size={12} />
                                            Copy tất cả
                                        </button>
                                    )}
                                </div>
                                {addresses.length === 0 ? (
                                    <div className="text-xs text-[#9c8573]">Chưa có địa chỉ. Thêm địa chỉ để bắt đầu.</div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {addresses.map((addr, idx) => (
                                            <div
                                                key={addr.emailAddress || idx}
                                                className="flex items-center gap-2 bg-[#fff8ef] px-3 py-2 rounded-xl border border-[#ead8c5]"
                                            >
                                                <span className="text-sm font-bold text-[#2a1f1a]">{addr.emailAddress}</span>
                                                <button
                                                    onClick={() => removeEmailFromGroup(addr.emailAddress)}
                                                    className="text-[#b63b3b] hover:text-[#8f2e2e]"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Emails */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-black text-[#6b5b52] uppercase tracking-widest">
                                        Email nhận ({emails.length})
                                    </div>
                                </div>
                                {loading ? (
                                    <div className="py-12 text-center">
                                        <RefreshCw className="w-8 h-8 text-[#c5532d] animate-spin mx-auto mb-3" />
                                        <p className="text-[#9c8573] font-bold">Đang tải...</p>
                                    </div>
                                ) : emails.length === 0 ? (
                                    <div className="py-16 text-center border-2 border-dashed border-[#ead8c5] rounded-2xl">
                                        <MailIcon size={48} className="mx-auto text-[#e2cdb5] mb-4" />
                                        <p className="text-[#9c8573] font-bold">Chưa có email nào</p>
                                        <p className="text-[#b59c8b] text-sm mt-1">Email gửi đến các địa chỉ trong nhóm sẽ hiển thị ở đây</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {emails.map((email, idx) => (
                                            <motion.div
                                                key={email.id || idx}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="group bg-[#f8efe4] p-6 rounded-2xl border border-[#ead8c5] hover:bg-[#fff8ef] hover:shadow-lg hover:shadow-[#c5532d]/10 transition-all cursor-pointer"
                                                onClick={() => setSelectedEmail(email)}
                                            >
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <h4 className="text-lg font-extrabold text-[#2a1f1a] leading-tight group-hover:text-[#c5532d] transition-colors flex-1 font-display">
                                                            {email.subject || '(Không có chủ đề)'}
                                                        </h4>
                                                        <div className="shrink-0 px-3 py-1 bg-[#fff8ef] rounded-xl text-xs font-bold text-[#9c8573] border border-[#ead8c5]">
                                                            {new Date(email.receivedAt).toLocaleDateString('vi-VN')}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-[#ead8c5]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-[#e8f2ed] text-[#1f6a5c] rounded-lg flex items-center justify-center">
                                                                <User size={14} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-[#9c8573] uppercase tracking-widest">Từ</span>
                                                                <span className="text-sm font-bold text-[#2a1f1a]">{email.from?.address}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-[#f7e6d4] text-[#c5532d] rounded-lg flex items-center justify-center">
                                                                <Send size={14} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-[#9c8573] uppercase tracking-widest">Đến</span>
                                                                <span className="text-sm font-bold text-[#2a1f1a]">{email.to}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-[#fff8ef] rounded-3xl p-8 max-w-md w-full border border-[#ead8c5] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-[#2a1f1a] mb-6 font-display">Tạo nhóm mới</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#6b5b52] mb-2">
                                        Tên nhóm
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && createGroup()}
                                        placeholder="Ví dụ: Công việc, Cá nhân..."
                                        className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-2xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-[#6b5b52] mb-2">
                                        Màu sắc
                                    </label>
                                    <div className="flex gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-10 h-10 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-offset-2 ring-[#c5532d]' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 btn-secondary h-12"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={createGroup}
                                    className="flex-1 btn-primary h-12"
                                >
                                    Tạo nhóm
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Group Modal */}
            <AnimatePresence>
                {showEditModal && editingGroup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowEditModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-[#fff8ef] rounded-3xl p-8 max-w-md w-full border border-[#ead8c5] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-[#2a1f1a] mb-6 font-display">Chỉnh sửa nhóm</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#6b5b52] mb-2">
                                        Tên nhóm
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateGroup()}
                                        placeholder="Ví dụ: Công việc, Cá nhân..."
                                        className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-2xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-[#6b5b52] mb-2">
                                        Màu sắc
                                    </label>
                                    <div className="flex gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-10 h-10 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-offset-2 ring-[#c5532d]' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 btn-secondary h-12"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={updateGroup}
                                    className="flex-1 btn-primary h-12"
                                >
                                    Lưu thay đổi
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Email Modal */}
            <AnimatePresence>
                {showAddEmailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowAddEmailModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-[#fff8ef] rounded-3xl p-8 max-w-md w-full border border-[#ead8c5] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-[#2a1f1a] mb-2 font-display">
                                Thêm email vào nhóm
                            </h3>
                            <p className="text-sm text-[#6b5b52] mb-6">
                                Có thể thêm nhiều email cùng lúc, mỗi email một dòng
                            </p>

                            <textarea
                                value={newEmailAddress}
                                onChange={(e) => setNewEmailAddress(e.target.value)}
                                placeholder={"email1@example.com\nemail2@example.com\nemail3@example.com"}
                                rows={5}
                                className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-2xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none mb-6 resize-none"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAddEmailModal(false)}
                                    className="flex-1 btn-secondary h-12"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={addEmailToGroup}
                                    className="flex-1 btn-primary h-12"
                                >
                                    Thêm
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Email Detail Modal */}
            <AnimatePresence>
                {selectedEmail && (
                    <EmailDetailModal
                        email={selectedEmail}
                        onClose={() => setSelectedEmail(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}
