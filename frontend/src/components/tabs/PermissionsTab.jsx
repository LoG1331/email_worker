import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Shield, User, Mail, Check, X, Globe, AtSign, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PermissionsTab({ apiKey }) {
    const [pending, setPending] = useState([])
    const [users, setUsers] = useState([])
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeSection, setActiveSection] = useState('pending')
    const [expandedUser, setExpandedUser] = useState(null)

    useEffect(() => {
        if (apiKey) loadAll()
    }, [apiKey])

    const authHeaders = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

    const loadAll = async () => {
        setLoading(true)
        try {
            const [pendingRes, usersRes, permsRes] = await Promise.all([
                fetch('/api/pending', { headers: authHeaders }),
                fetch('/api/users', { headers: authHeaders }),
                fetch('/api/permissions', { headers: authHeaders })
            ])
            if (pendingRes.ok) setPending((await pendingRes.json()).requests || [])
            if (usersRes.ok) setUsers((await usersRes.json()).users || [])
            if (permsRes.ok) setPermissions((await permsRes.json()).permissions || [])
        } catch {
            toast.error('Lỗi kết nối')
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id, type) => {
        const req = pending.find(r => r.id === id)
        try {
            const res = await fetch(`/api/pending/${id}/approve`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ type, target: type === 'EMAIL' ? req.email : null })
            })
            if (res.ok) {
                toast.success(`Đã cấp quyền ${type}`)
                loadAll()
            }
        } catch {
            toast.error('Lỗi')
        }
    }

    const handleReject = async (id) => {
        try {
            const res = await fetch(`/api/pending/${id}/reject`, {
                method: 'POST',
                headers: authHeaders
            })
            if (res.ok) {
                toast.success('Đã từ chối')
                loadAll()
            }
        } catch {
            toast.error('Lỗi')
        }
    }

    const handleRevoke = async (userId, type, target) => {
        try {
            const url = new URL('/api/permissions', window.location.origin)
            url.searchParams.set('userId', userId)
            url.searchParams.set('type', type)
            if (target) url.searchParams.set('target', target)

            const res = await fetch(url, { method: 'DELETE', headers: authHeaders })
            if (res.ok) {
                toast.success('Đã thu hồi')
                loadAll()
            }
        } catch {
            toast.error('Lỗi')
        }
    }

    const handleGrantDomain = async (userId) => {
        try {
            const res = await fetch('/api/permissions', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ userId, type: 'DOMAIN', target: null })
            })
            if (res.ok) {
                toast.success('Đã cấp Full Domain')
                loadAll()
            }
        } catch {
            toast.error('Lỗi')
        }
    }

    // Get permissions for a specific user
    const getUserPerms = (userId) => permissions.filter(p => p.userId === userId)

    // Check if user has domain permission
    const hasDomainPerm = (userId) => permissions.some(p => p.userId === userId && p.type === 'DOMAIN')

    const sections = [
        { id: 'pending', label: 'Chờ duyệt', count: pending.length },
        { id: 'users', label: 'Users', count: users.length },
    ]

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    {sections.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSection === s.id
                                    ? 'bg-[#2a1f1a] text-white'
                                    : 'bg-[#fff8ef] text-[#6b5b52] hover:bg-[#f6ecdf]'
                                }`}
                        >
                            {s.label}
                            {s.count > 0 && (
                                <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${activeSection === s.id ? 'bg-white/20' : 'bg-[#f1e3d4]'
                                    }`}>{s.count}</span>
                            )}
                        </button>
                    ))}
                </div>
                <button onClick={loadAll} disabled={loading} className="btn-primary h-10 px-6 flex items-center gap-2">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Pending Requests */}
            {activeSection === 'pending' && (
                <div className="space-y-4">
                    {pending.length === 0 ? (
                        <div className="surface-soft py-16 rounded-3xl text-center">
                            <Check size={48} className="mx-auto text-[#1f6a5c] mb-4" />
                            <p className="text-[#9c8573] font-bold">Không có yêu cầu đang chờ</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {pending.map((req, idx) => (
                                <motion.div
                                    key={req.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-6 rounded-2xl surface-panel"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-[#f7e6d4] text-[#c5532d] rounded-xl flex items-center justify-center">
                                                <User size={24} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#2a1f1a]">
                                                    {req.user?.firstName} {req.user?.lastName}
                                                    {req.user?.username && <span className="text-[#9c8573] ml-2">@{req.user.username}</span>}
                                                </div>
                                                <div className="text-sm text-[#6b5b52] flex items-center gap-2">
                                                    <Mail size={14} />
                                                    <span className="font-mono">{req.email}@...</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(req.id, 'DOMAIN')}
                                                className="px-4 py-2 bg-[#1f6a5c] text-white rounded-xl text-sm font-bold hover:bg-[#1b5d52] flex items-center gap-2"
                                            >
                                                <Globe size={16} /> Full Domain
                                            </button>
                                            <button
                                                onClick={() => handleApprove(req.id, 'EMAIL')}
                                                className="px-4 py-2 bg-[#c5532d] text-white rounded-xl text-sm font-bold hover:bg-[#b94927] flex items-center gap-2"
                                            >
                                                <AtSign size={16} /> Chỉ Email
                                            </button>
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                className="px-4 py-2 bg-[#f6dede] text-[#b63b3b] rounded-xl text-sm font-bold hover:bg-[#f2cfcf]"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            )}

            {/* Users with expandable details */}
            {activeSection === 'users' && (
                <div className="space-y-3">
                    {users.length === 0 ? (
                        <div className="surface-soft py-16 rounded-3xl text-center">
                            <User size={48} className="mx-auto text-[#d5c2ad] mb-4" />
                            <p className="text-[#9c8573] font-bold">Chưa có user nào</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {users.map((user, idx) => {
                                const isExpanded = expandedUser === user.userId
                                const userPerms = getUserPerms(user.userId)
                                const hasDomain = hasDomainPerm(user.userId)

                                return (
                                    <motion.div
                                        key={user.userId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="rounded-2xl border border-[#ead8c5] shadow-sm overflow-hidden surface-panel"
                                    >
                                        {/* Preview Row */}
                                        <div
                                            onClick={() => setExpandedUser(isExpanded ? null : user.userId)}
                                            className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#f6ecdf] transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${hasDomain ? 'bg-[#def3e6] text-[#1f6a5c]' : 'bg-[#f7e6d4] text-[#c5532d]'
                                                    }`}>
                                                    {hasDomain ? <Globe size={22} /> : <User size={22} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#2a1f1a] flex items-center gap-2">
                                                        {user.firstName} {user.lastName}
                                                        {user.username && <span className="text-[#9c8573] text-sm">@{user.username}</span>}
                                                        {hasDomain && (
                                                            <span className="px-2 py-0.5 bg-[#def3e6] text-[#1f6a5c] text-xs font-bold rounded-lg">FULL</span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-[#6b5b52]">
                                                        {user.emails?.length || 0} email • {userPerms.length} quyền
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {!hasDomain && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleGrantDomain(user.userId); }}
                                                        className="px-3 py-1.5 bg-[#def3e6] text-[#1f6a5c] rounded-lg text-xs font-bold hover:bg-[#cbe8d8]"
                                                    >
                                                        + Full Domain
                                                    </button>
                                                )}
                                                {isExpanded ? <ChevronUp size={20} className="text-[#9c8573]" /> : <ChevronDown size={20} className="text-[#9c8573]" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-[#ead8c5] bg-[#f8efe4]"
                                                >
                                                    <div className="p-5 space-y-4">
                                                        {/* Permissions */}
                                                        {userPerms.length > 0 && (
                                                            <div>
                                                                <div className="text-xs font-bold text-[#9c8573] uppercase tracking-widest mb-3">Quyền</div>
                                                                <div className="space-y-2">
                                                                    {userPerms.map((perm, i) => (
                                                                        <div key={i} className="flex items-center justify-between bg-[#fff8ef] p-3 rounded-xl border border-[#ead8c5]">
                                                                            <div className="flex items-center gap-3">
                                                                                {perm.type === 'DOMAIN' ? (
                                                                                    <Globe size={16} className="text-[#1f6a5c]" />
                                                                                ) : (
                                                                                    <AtSign size={16} className="text-[#c5532d]" />
                                                                                )}
                                                                                <span className="text-sm font-medium text-[#2a1f1a]">
                                                                                    {perm.type === 'DOMAIN' ? 'Full Domain' : perm.target}
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleRevoke(user.userId, perm.type, perm.target)}
                                                                                className="p-2 text-[#b63b3b] hover:bg-[#f6dede] rounded-lg transition-colors"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Emails */}
                                                        {user.emails?.length > 0 && (
                                                            <div>
                                                                <div className="text-xs font-bold text-[#9c8573] uppercase tracking-widest mb-3">Emails đã tạo</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {user.emails.map((email, i) => (
                                                                        <span key={i} className="px-3 py-1.5 bg-[#fff8ef] border border-[#ead8c5] rounded-lg text-sm font-mono text-[#6b5b52]">
                                                                            {email}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {userPerms.length === 0 && (!user.emails || user.emails.length === 0) && (
                                                            <p className="text-sm text-[#9c8573] text-center py-4">Chưa có dữ liệu</p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    )}
                </div>
            )}
        </motion.div>
    )
}
