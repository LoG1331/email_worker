import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, Mail as MailIcon, Calendar, User, Send, ChevronLeft, ChevronRight, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import EmailDetailModal from '../modals/EmailDetailModal'
import GroupSelector from '../shared/GroupSelector'

export default function EmailsTab({ apiKey, allEmails, setAllEmails }) {
    const [filteredEmails, setFilteredEmails] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedEmail, setSelectedEmail] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalEmails, setTotalEmails] = useState(0)

    const [selectedEmailIds, setSelectedEmailIds] = useState([])
    const [deleting, setDeleting] = useState(false)
    const emailsPerPage = 100
    const [polling, setPolling] = useState(false)
    const [pollInterval, setPollInterval] = useState(30000)
    const [activeGroupSelector, setActiveGroupSelector] = useState(null)

    useEffect(() => {
        if (apiKey) {
            loadEmails()
        }
    }, [apiKey, currentPage])



    useEffect(() => {
        const query = searchQuery.toLowerCase()
        setFilteredEmails(
            allEmails.filter(email =>
                email.subject?.toLowerCase().includes(query) ||
                email.from?.address?.toLowerCase().includes(query) ||
                email.to?.toLowerCase().includes(query)
            )
        )
    }, [searchQuery, allEmails])

    // Auto-reload emails when toggled on
    useEffect(() => {
        if (!apiKey || !polling || pollInterval <= 0) return
        const id = setInterval(() => {
            loadEmails({ silent: true })
        }, pollInterval)
        return () => clearInterval(id)
    }, [apiKey, polling, pollInterval, currentPage])

    const loadEmails = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true)
        try {
            const offset = (currentPage - 1) * emailsPerPage
            const response = await fetch(`/api/all?limit=${emailsPerPage}&offset=${offset}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setAllEmails(data.emails || [])
                setTotalEmails(data.total || 0)
                if (!silent) toast.success(`Đã tải ${data.emails?.length || 0} emails (Trang ${currentPage})`)
            }
        } catch {
            if (!silent) toast.error('Lỗi kết nối')
        } finally {
            if (!silent) setLoading(false)
        }
    }



    const toggleSelectEmail = (emailId) => {
        setSelectedEmailIds(prev =>
            prev.includes(emailId)
                ? prev.filter(id => id !== emailId)
                : [...prev, emailId]
        )
    }

    const toggleSelectAll = () => {
        if (selectedEmailIds.length === filteredEmails.length) {
            setSelectedEmailIds([])
        } else {
            setSelectedEmailIds(filteredEmails.map(e => e.id))
        }
    }

    const deleteSelectedEmails = async () => {
        if (selectedEmailIds.length === 0) return

        if (!confirm(`Bạn có chắc muốn xóa ${selectedEmailIds.length} email?`)) return

        setDeleting(true)
        try {
            const deletePromises = selectedEmailIds.map(id =>
                fetch(`/api/email/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })
            )

            await Promise.all(deletePromises)
            toast.success(`Đã xóa ${selectedEmailIds.length} email`)
            setSelectedEmailIds([])
            loadEmails()
        } catch {
            toast.error('Lỗi xóa email')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-20">
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-5 items-center p-4 rounded-3xl surface-panel">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8573]" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm nội dung, người gửi..."
                        className="w-full pl-12 pr-4 py-3 bg-[#fffdf8] border border-transparent rounded-2xl focus:ring-2 focus:ring-[#d59b46]/30 focus:border-[#d59b46] outline-none text-sm font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 items-center">
                    {selectedEmailIds.length > 0 && (
                        <button
                            onClick={deleteSelectedEmails}
                            disabled={deleting}
                            className="btn-danger h-12 px-6 flex items-center gap-3"
                        >
                            <Trash2 size={18} className={deleting ? 'animate-pulse' : ''} />
                            Xóa ({selectedEmailIds.length})
                        </button>
                    )}
                    <button onClick={() => loadEmails()} disabled={loading} className="btn-primary h-12 px-8 flex items-center gap-3">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
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
                            Auto reload
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
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {[
                    { label: 'Tổng Email hệ thống', value: totalEmails, bg: 'bg-[#1f6a5c]', text: 'text-white' },
                    { label: 'Email hiển thị', value: allEmails.length, bg: 'bg-[#c5532d]', text: 'text-white' },
                    { label: 'Kết quả tìm kiếm', value: filteredEmails.length, bg: 'bg-[#fff8ef]', text: 'text-ink border border-[#ead8c5]' },
                ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} ${stat.text} p-8 rounded-[2.5rem] shadow-sm transform transition-transform hover:-translate-y-1`}>
                        <div className="text-sm font-black uppercase tracking-widest opacity-70 mb-2">{stat.label}</div>
                        <div className={`text-4xl font-black font-display`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-6 rounded-3xl surface-panel">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm font-bold text-[#6b5b52]">
                        Trang {currentPage} / {Math.ceil(totalEmails / emailsPerPage)}
                        <span className="ml-2 text-[#9c8573]">
                            (Email {((currentPage - 1) * emailsPerPage) + 1} - {Math.min(currentPage * emailsPerPage, totalEmails)})
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1 || loading}
                            className="btn-secondary h-10 px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                            Trước
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalEmails / emailsPerPage), prev + 1))}
                            disabled={currentPage >= Math.ceil(totalEmails / emailsPerPage) || loading}
                            className="btn-secondary h-10 px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sau
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {loading && allEmails.length === 0 ? (
                    <div className="py-20 text-center">
                        <RefreshCw className="w-10 h-10 text-[#c5532d] animate-spin mx-auto mb-4" />
                        <p className="text-[#6b5b52] font-bold">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredEmails.length === 0 ? (
                    <div className="surface-soft py-24 rounded-[3rem] text-center">
                        <MailIcon size={64} className="mx-auto text-[#e2cdb5] mb-6" />
                        <p className="text-[#9c8573] font-bold text-lg">Hộp thư đang trống</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Select All */}
                        <div className="p-4 rounded-2xl surface-panel flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedEmailIds.length === filteredEmails.length && filteredEmails.length > 0}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 rounded border-[#cdb8a3] text-[#c5532d] focus:ring-2 focus:ring-[#d59b46]/40"
                            />
                            <span className="text-sm font-bold text-[#6b5b52]">
                                Chọn tất cả ({filteredEmails.length} email)
                            </span>
                        </div>

                        <div className="grid gap-6">
                            <AnimatePresence>
                                {filteredEmails.map((email, idx) => (
                                    <motion.div
                                        key={email.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="group p-8 rounded-[2rem] border border-[#ead8c5] shadow-sm hover:shadow-xl hover:shadow-[#c5532d]/10 transition-all cursor-pointer relative overflow-hidden surface-panel"
                                        onClick={() => setSelectedEmail(email)}
                                    >
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEmailIds.includes(email.id)}
                                                        onChange={(e) => {
                                                            e.stopPropagation()
                                                            toggleSelectEmail(email.id)
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-1 w-5 h-5 rounded border-[#cdb8a3] text-[#c5532d] focus:ring-2 focus:ring-[#d59b46]/40"
                                                    />
                                                    <h3 className="text-xl font-extrabold text-[#2a1f1a] leading-tight group-hover:text-[#c5532d] transition-colors flex-1 font-display">
                                                        {email.subject || '(Không có chủ đề)'}
                                                    </h3>
                                                </div>
                                                <div className="shrink-0 px-4 py-2 bg-[#f7eee4] rounded-2xl text-xs font-bold text-[#9c8573] border border-[#ead8c5] uppercase tracking-tighter">
                                                    {new Date(email.receivedAt).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-6 items-center pt-6 border-t border-[#ead8c5]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[#e8f2ed] text-[#1f6a5c] rounded-xl flex items-center justify-center">
                                                        <User size={18} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-[#9c8573] uppercase tracking-widest">Từ</span>
                                                        <span className="text-sm font-bold text-[#2a1f1a]">{email.from?.address}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[#f7e6d4] text-[#c5532d] rounded-xl flex items-center justify-center">
                                                        <Send size={18} />
                                                    </div>
                                                    <div className="flex flex-col relative">
                                                        <span className="text-[10px] font-black text-[#9c8573] uppercase tracking-widest">Đến</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-[#2a1f1a]">{email.to}</span>
                                                            {email.to && (
                                                                <GroupSelector
                                                                    emailAddress={email.to}
                                                                    apiKey={apiKey}
                                                                    onGroupToggle={() => {
                                                                        toast.success('Đã cập nhật nhóm')
                                                                    }}
                                                                    idKey={`${email.id || email.to}-selector`}
                                                                    activeKey={activeGroupSelector}
                                                                    setActiveKey={setActiveGroupSelector}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </div>

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
