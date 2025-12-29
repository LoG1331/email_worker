import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Mail as MailIcon, User, Send, X, RefreshCw, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import EmailDetailModal from '../modals/EmailDetailModal'

const PRESET_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#EF4444', // Red
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6B7280', // Gray
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
                console.log('Group data:', data)
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-slate-800">Quản lý Nhóm Email</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary h-12 px-6 flex items-center gap-3"
                >
                    <Plus size={18} />
                    Tạo nhóm mới
                </button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <motion.div
                        key={group.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setSelectedGroup(group)}
                        className={`group p-6 rounded-3xl cursor-pointer transition-all ${selectedGroup?.id === group.id
                            ? 'bg-white shadow-xl ring-2 ring-blue-500'
                            : 'bg-white shadow-sm hover:shadow-lg'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: group.color }}
                                />
                                <h3 className="text-lg font-black text-slate-800">{group.name}</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => openEditModal(group, e)}
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                    title="Chỉnh sửa nhóm"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteGroup(group.id)
                                    }}
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors"
                                    title="Xóa nhóm"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="text-sm text-slate-500">
                            {group.emailCount} email{group.emailCount !== 1 ? 's' : ''}
                        </div>
                    </motion.div>
                ))}

                {groups.length === 0 && (
                    <div className="col-span-full bg-white py-24 rounded-3xl text-center border-2 border-dashed border-slate-200">
                        <MailIcon size={64} className="mx-auto text-slate-200 mb-6" />
                        <p className="text-slate-400 font-bold text-lg">Chưa có nhóm nào</p>
                        <p className="text-slate-300 text-sm mt-2">Tạo nhóm đầu tiên để bắt đầu</p>
                    </div>
                )}
            </div>

            {/* Selected Group Emails */}
            {selectedGroup && (
                <div className="bg-white p-8 rounded-3xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-6 h-6 rounded-full"
                                style={{ backgroundColor: selectedGroup.color }}
                            />
                            <h3 className="text-2xl font-black text-slate-800">{selectedGroup.name}</h3>
                        </div>
                        <button
                            onClick={() => setShowAddEmailModal(true)}
                            className="btn-secondary h-10 px-6 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Thêm địa chỉ email
                        </button>
                    </div>

                    {/* Email Addresses in Group */}
                    {addresses.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                    Địa chỉ email trong nhóm ({addresses.length})
                                </div>
                                <button
                                    onClick={() => {
                                        const emailList = addresses.map(a => a.emailAddress).join('\n')
                                        navigator.clipboard.writeText(emailList)
                                        toast.success(`Đã copy ${addresses.length} địa chỉ email`)
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
                                    title="Copy tất cả email"
                                >
                                    <Copy size={12} />
                                    Copy tất cả
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {addresses.map((addr, idx) => (
                                    <div
                                        key={addr.emailAddress || idx}
                                        className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200"
                                    >
                                        <span className="text-sm font-bold text-slate-700">{addr.emailAddress}</span>
                                        <button
                                            onClick={() => removeEmailFromGroup(addr.emailAddress)}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actual Emails Received */}
                    <div>
                        <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                            Email đã nhận ({emails.length})
                        </div>
                        {loading ? (
                            <div className="py-12 text-center">
                                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                                <p className="text-slate-400 font-bold">Đang tải...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                                <MailIcon size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 font-bold">Chưa có email nào</p>
                                <p className="text-slate-300 text-sm mt-1">Email gửi đến các địa chỉ trong nhóm sẽ hiển thị ở đây</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {emails.map((email, idx) => (
                                    <motion.div
                                        key={email.id || idx}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-blue-900/5 transition-all cursor-pointer"
                                        onClick={() => setSelectedEmail(email)}
                                    >
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <h4 className="text-lg font-extrabold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors flex-1">
                                                    {email.subject || '(Không có chủ đề)'}
                                                </h4>
                                                <div className="shrink-0 px-3 py-1 bg-white rounded-xl text-xs font-bold text-slate-400 border border-slate-100">
                                                    {new Date(email.receivedAt).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                                        <User size={14} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ</span>
                                                        <span className="text-sm font-bold text-slate-700">{email.from?.address}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                                        <Send size={14} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến</span>
                                                        <span className="text-sm font-bold text-slate-700">{email.to}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            className="bg-white rounded-3xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-slate-800 mb-6">Tạo nhóm mới</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">
                                        Tên nhóm
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && createGroup()}
                                        placeholder="Ví dụ: Công việc, Cá nhân..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">
                                        Màu sắc
                                    </label>
                                    <div className="flex gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-10 h-10 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : ''
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
                            className="bg-white rounded-3xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-slate-800 mb-6">Chỉnh sửa nhóm</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">
                                        Tên nhóm
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateGroup()}
                                        placeholder="Ví dụ: Công việc, Cá nhân..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">
                                        Màu sắc
                                    </label>
                                    <div className="flex gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-10 h-10 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : ''
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
                            className="bg-white rounded-3xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-black text-slate-800 mb-2">
                                Thêm email vào nhóm
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Có thể thêm nhiều email cùng lúc, mỗi email một dòng
                            </p>

                            <textarea
                                value={newEmailAddress}
                                onChange={(e) => setNewEmailAddress(e.target.value)}
                                placeholder={"email1@example.com\nemail2@example.com\nemail3@example.com"}
                                rows={5}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none mb-6 resize-none"
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
