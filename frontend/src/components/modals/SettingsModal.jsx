import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, X, Key, Mail, Bot, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsModal({ isOpen, onClose, apiKey }) {
    const [loading, setLoading] = useState(false)
    const [configInfo, setConfigInfo] = useState(null)
    const [editMode, setEditMode] = useState(false)
    const [newConfig, setNewConfig] = useState({
        BOT_TOKEN: '',
        API_KEY: '',
        EMAIL_DOMAIN: ''
    })

    const loadConfig = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/config')
            const data = await response.json()
            setConfigInfo(data)
        } catch (error) {
            toast.error('Không thể tải cấu hình')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            loadConfig()
        }
    }, [isOpen])

    const handleSave = async () => {
        if (!newConfig.BOT_TOKEN || !newConfig.API_KEY || !newConfig.EMAIL_DOMAIN) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            })
            const data = await response.json()

            if (response.ok) {
                toast.success('Đã cập nhật cấu hình!')
                setEditMode(false)
                loadConfig()
            } else {
                toast.error(data.error || 'Lỗi cập nhật')
            }
        } catch (error) {
            toast.error('Lỗi kết nối')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#c5532d] to-[#d59b46] rounded-xl flex items-center justify-center">
                                <Settings size={20} className="text-white" />
                            </div>
                            <h2 className="text-xl font-black text-[#2a1f1a]">Cấu hình hệ thống</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-[#f6ecdf] rounded-xl transition-colors">
                            <X size={20} className="text-[#6b5b52]" />
                        </button>
                    </div>

                    {loading && !configInfo ? (
                        <div className="py-12 text-center">
                            <RefreshCw className="w-8 h-8 text-[#c5532d] animate-spin mx-auto mb-3" />
                            <p className="text-[#9c8573] font-bold">Đang tải...</p>
                        </div>
                    ) : configInfo ? (
                        <div className="space-y-4">
                            {/* Status */}
                            <div className="bg-[#f8efe4] rounded-2xl p-4 border border-[#ead8c5]">
                                <div className="flex items-center gap-3 mb-3">
                                    {configInfo.configured ? (
                                        <CheckCircle size={20} className="text-green-600" />
                                    ) : (
                                        <AlertCircle size={20} className="text-orange-500" />
                                    )}
                                    <span className="font-bold text-[#2a1f1a]">
                                        {configInfo.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}
                                    </span>
                                </div>
                                <div className="text-sm text-[#6b5b52] space-y-1">
                                    <div>📦 Nguồn: <span className="font-bold">{configInfo.source === 'kv' ? 'KV Store' : configInfo.source === 'env' ? 'Environment Variables' : 'Không có'}</span></div>
                                    <div>💾 KV Config: <span className="font-bold">{configInfo.raw?.hasKvConfig ? 'Có' : 'Không'}</span></div>
                                    <div>🔐 Env Vars: <span className="font-bold">{configInfo.raw?.hasEnvConfig ? 'Có' : 'Không'}</span></div>
                                </div>
                            </div>

                            {/* Current Config */}
                            {configInfo.config && (
                                <div className="space-y-3">
                                    <div className="text-xs font-black text-[#6b5b52] uppercase tracking-wider">Cấu hình hiện tại</div>

                                    <div className="bg-[#fffdf8] rounded-xl p-4 border border-[#ead8c5] space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Bot size={16} className="text-[#c5532d]" />
                                            <span className="text-sm font-bold text-[#6b5b52]">BOT_TOKEN:</span>
                                            <code className="text-sm font-mono bg-[#f6ecdf] px-2 py-1 rounded">{configInfo.config.BOT_TOKEN}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Key size={16} className="text-[#c5532d]" />
                                            <span className="text-sm font-bold text-[#6b5b52]">API_KEY:</span>
                                            <code className="text-sm font-mono bg-[#f6ecdf] px-2 py-1 rounded">{configInfo.config.API_KEY}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail size={16} className="text-[#c5532d]" />
                                            <span className="text-sm font-bold text-[#6b5b52]">EMAIL_DOMAIN:</span>
                                            <code className="text-sm font-mono bg-[#f6ecdf] px-2 py-1 rounded">{configInfo.config.EMAIL_DOMAIN}</code>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Edit Mode */}
                            {editMode ? (
                                <div className="space-y-4 pt-4 border-t border-[#ead8c5]">
                                    <div className="text-xs font-black text-[#6b5b52] uppercase tracking-wider">Cập nhật cấu hình (KV Store)</div>

                                    <div>
                                        <label className="text-sm font-bold text-[#6b5b52] mb-1 block">BOT_TOKEN</label>
                                        <input
                                            type="text"
                                            value={newConfig.BOT_TOKEN}
                                            onChange={(e) => setNewConfig({ ...newConfig, BOT_TOKEN: e.target.value })}
                                            placeholder="123456789:ABCdef..."
                                            className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-[#6b5b52] mb-1 block">API_KEY</label>
                                        <input
                                            type="password"
                                            value={newConfig.API_KEY}
                                            onChange={(e) => setNewConfig({ ...newConfig, API_KEY: e.target.value })}
                                            placeholder="your-api-key"
                                            className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-[#6b5b52] mb-1 block">EMAIL_DOMAIN</label>
                                        <input
                                            type="text"
                                            value={newConfig.EMAIL_DOMAIN}
                                            onChange={(e) => setNewConfig({ ...newConfig, EMAIL_DOMAIN: e.target.value })}
                                            placeholder="example.com"
                                            className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none text-sm"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setEditMode(false)}
                                            className="btn-secondary flex-1 h-11"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={loading}
                                            className="btn-primary flex-1 h-11 flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <RefreshCw size={16} className="animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={loadConfig}
                                        disabled={loading}
                                        className="btn-secondary flex-1 h-11 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                        Làm mới
                                    </button>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="btn-primary flex-1 h-11 flex items-center justify-center gap-2"
                                    >
                                        <Settings size={16} />
                                        Sửa cấu hình
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <AlertCircle size={48} className="text-orange-500 mx-auto mb-4" />
                            <p className="text-[#9c8573] font-bold">Không thể tải cấu hình</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
