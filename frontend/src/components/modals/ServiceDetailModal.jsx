import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Mail, Trash2, RefreshCw, Calendar, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ServiceDetailModal({ service, onClose, apiKey, onEmailDeleted }) {
    const [emails, setEmails] = useState([])
    const [loading, setLoading] = useState(true)
    const [deletingEmail, setDeletingEmail] = useState(null)

    useEffect(() => {
        loadEmails()
    }, [service])

    const loadEmails = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/service/${encodeURIComponent(service.service)}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setEmails(data.emails || [])
            }
        } catch (error) {
            toast.error('Lỗi tải danh sách email')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteEmail = async (email) => {
        if (!confirm(`Xóa tracking của email "${email}" khỏi dịch vụ này?`)) return

        setDeletingEmail(email)
        try {
            const response = await fetch(
                `/api/service/${encodeURIComponent(service.service)}/email/${encodeURIComponent(email)}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                }
            )

            if (response.ok) {
                toast.success('Đã xóa email khỏi dịch vụ')
                setEmails(prev => prev.filter(e => e.email !== email))
                onEmailDeleted?.()
            } else {
                toast.error('Lỗi xóa email')
            }
        } catch (error) {
            toast.error('Lỗi kết nối')
        } finally {
            setDeletingEmail(null)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#fff8ef] rounded-[2.5rem] shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-[#ead8c5]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 border-b border-[#ead8c5] flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-[#2a1f1a] font-display">Chi tiết dịch vụ</h2>
                        <p className="text-sm font-bold text-[#c5532d] mt-1">{service.service}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-2xl bg-[#f1e3d4] hover:bg-[#e8d4be] flex items-center justify-center transition-colors"
                    >
                        <X size={20} className="text-[#6b5b52]" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto max-h-[calc(80vh-200px)]">
                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw className="w-10 h-10 text-[#1f6a5c] animate-spin mx-auto mb-4" />
                            <p className="text-[#6b5b52] font-bold">Đang tải...</p>
                        </div>
                    ) : emails.length === 0 ? (
                        <div className="py-20 text-center">
                            <Mail size={64} className="mx-auto text-[#e2cdb5] mb-6" />
                            <p className="text-[#9c8573] font-bold text-lg">Không có email nào</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {emails.map((emailItem, idx) => (
                                <motion.div
                                    key={emailItem.email}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="bg-[#f8efe4] p-6 rounded-2xl border border-[#ead8c5] hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-[#e8f2ed] text-[#1f6a5c] rounded-xl flex items-center justify-center shrink-0">
                                                    <Mail size={18} />
                                                </div>
                                                <h3 className="text-lg font-bold text-[#2a1f1a] truncate font-display">
                                                    {emailItem.email}
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                <div className="flex items-center gap-2 text-[#6b5b52]">
                                                    <Hash size={14} className="text-[#9c8573]" />
                                                    <span className="font-bold">{emailItem.emailCount} tin nhắn</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[#6b5b52]">
                                                    <Calendar size={14} className="text-[#9c8573]" />
                                                    <span className="font-medium">
                                                        {new Date(emailItem.firstSeen).toLocaleDateString('vi-VN')}
                                                        {' → '}
                                                        {new Date(emailItem.lastSeen).toLocaleDateString('vi-VN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEmail(emailItem.email)}
                                            disabled={deletingEmail === emailItem.email}
                                            className="shrink-0 w-12 h-12 rounded-xl bg-[#f6dede] hover:bg-[#f2cfcf] text-[#b63b3b] flex items-center justify-center transition-colors disabled:opacity-50"
                                        >
                                            {deletingEmail === emailItem.email ? (
                                                <RefreshCw size={18} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-[#ead8c5] bg-[#f8efe4]">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[#6b5b52]">
                            Tổng số: <span className="text-[#c5532d]">{emails.length} email</span>
                        </p>
                        <button
                            onClick={loadEmails}
                            disabled={loading}
                            className="btn-primary h-10 px-6 flex items-center gap-2 text-sm"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Làm mới
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
