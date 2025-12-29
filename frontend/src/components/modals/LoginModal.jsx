import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, Mail, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginModal({ onLogin }) {
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const resp = await fetch('/api/all?limit=1', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (resp.ok) {
                toast.success('Đã xác thực thành công!')
                onLogin(apiKey)
            } else {
                toast.error('API key không hợp lệ')
            }
        } catch {
            toast.error('Lỗi kết nối server')
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4"
        >
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-[128px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/30 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                className="relative max-w-md w-full"
            >
                {/* Card */}
                <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-10 shadow-2xl shadow-black/20 overflow-hidden">
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

                    {/* Top gradient bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />

                    {/* Header */}
                    <div className="relative flex flex-col items-center mb-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                            className="relative mb-6"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 rotate-3">
                                <Mail size={36} className="text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg -rotate-12">
                                <Sparkles size={16} className="text-white" />
                            </div>
                        </motion.div>

                        <h1 className="text-3xl font-black text-white tracking-tight">Email Manager</h1>
                        <p className="text-blue-200/70 text-sm mt-2 font-medium">Nhập API Key để truy cập hệ thống</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="relative space-y-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-blue-200/50 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Lock size={12} />
                                API Key
                            </label>
                            <div className="relative group">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-white/10 outline-none transition-all font-mono text-sm text-white placeholder:text-white/30"
                                    placeholder="sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                                >
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={loading || !apiKey}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Đăng nhập</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Footer hint */}
                    <p className="text-center text-white/30 text-xs mt-8">
                        Liên hệ admin nếu bạn chưa có API Key
                    </p>
                </div>
            </motion.div>
        </motion.div>
    )
}
