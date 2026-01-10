import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, Mail, Sparkles, Settings, Bot, Key } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginModal({ onLogin }) {
    const [activeTab, setActiveTab] = useState('login')  // 'login' or 'config'
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isConfigured, setIsConfigured] = useState(true)

    // Config state
    const [config, setConfig] = useState({
        BOT_TOKEN: '',
        API_KEY: '',
        EMAIL_DOMAIN: ''
    })

    // Check if configured on mount
    useEffect(() => {
        fetch('/api/config').then(r => r.json()).then(data => {
            setIsConfigured(data.configured)
            if (!data.configured) {
                setActiveTab('config')  // Auto switch to config tab if not configured
            }
        }).catch(() => { })
    }, [])

    const handleLogin = async (e) => {
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

    const handleConfig = async (e) => {
        e.preventDefault()
        if (!config.BOT_TOKEN || !config.API_KEY || !config.EMAIL_DOMAIN) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }
        setLoading(true)
        try {
            const resp = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            if (resp.ok) {
                toast.success('Cấu hình thành công!')
                setIsConfigured(true)
                setActiveTab('login')
                setApiKey(config.API_KEY)  // Auto-fill API key
            } else {
                const data = await resp.json()
                toast.error(data.error || 'Lỗi cấu hình')
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
            <div className="absolute inset-0 bg-gradient-to-br from-[#1c1410] via-[#2a1f1a] to-[#1f6a5c]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(213,155,70,0.2),_transparent_60%)]" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#c5532d]/30 rounded-full blur-[128px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1f6a5c]/30 rounded-full blur-[110px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                className="relative max-w-md w-full"
            >
                {/* Card */}
                <div className="relative bg-[#fff8ef] backdrop-blur-2xl border border-[#ead8c5] rounded-[2rem] p-10 shadow-2xl shadow-black/20 overflow-hidden">
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />

                    {/* Top gradient bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c5532d] via-[#e08a3d] to-[#1f6a5c]" />

                    {/* Header */}
                    <div className="relative flex flex-col items-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                            className="relative mb-5"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-[#1f6a5c] to-[#2f8f7b] rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-900/30 rotate-3">
                                <Mail size={36} className="text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#c5532d] to-[#e08a3d] rounded-lg flex items-center justify-center shadow-lg -rotate-12">
                                <Sparkles size={16} className="text-white" />
                            </div>
                        </motion.div>

                        <h1 className="text-3xl font-black text-[#2a1f1a] tracking-tight font-display">Email Manager</h1>
                    </div>

                    {/* Tabs */}
                    <div className="relative flex bg-[#efe1d2] rounded-xl p-1 mb-6">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'login'
                                ? 'bg-white text-[#2a1f1a] shadow-md'
                                : 'text-[#6b5b52] hover:text-[#2a1f1a]'
                                }`}
                        >
                            <Lock size={16} />
                            Đăng nhập
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'config'
                                ? 'bg-white text-[#2a1f1a] shadow-md'
                                : 'text-[#6b5b52] hover:text-[#2a1f1a]'
                                }`}
                        >
                            <Settings size={16} />
                            Cấu hình
                            {!isConfigured && <span className="w-2 h-2 bg-[#c5532d] rounded-full animate-pulse" />}
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'login' ? (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleLogin}
                                className="relative space-y-6"
                            >
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-[#6b5b52] uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <Lock size={12} />
                                        API Key
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type={showKey ? 'text' : 'password'}
                                            className="w-full px-5 py-4 bg-[#fffdf8] border border-[#ead8c5] rounded-2xl focus:ring-2 focus:ring-[#d59b46]/40 focus:border-[#d59b46] outline-none transition-all font-mono text-sm text-[#2a1f1a] placeholder:text-[#b59c8b]"
                                            placeholder="sk-..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b59c8b] hover:text-[#6b5b52] transition-colors"
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
                                    className="w-full py-4 bg-gradient-to-r from-[#c5532d] to-[#e08a3d] hover:from-[#b94927] hover:to-[#d98235] text-white font-bold rounded-2xl shadow-xl shadow-[#c5532d]/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

                                {!isConfigured && (
                                    <p className="text-center text-[#c5532d] text-xs font-medium">
                                        ⚠️ Chưa cấu hình. Vui lòng chuyển sang tab Cấu hình
                                    </p>
                                )}
                            </motion.form>
                        ) : (
                            <motion.form
                                key="config"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleConfig}
                                className="relative space-y-4"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#6b5b52] uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <Bot size={12} />
                                        Bot Token
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none font-mono text-sm"
                                        placeholder="123456789:ABCdefGHI..."
                                        value={config.BOT_TOKEN}
                                        onChange={(e) => setConfig({ ...config, BOT_TOKEN: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#6b5b52] uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <Key size={12} />
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none font-mono text-sm"
                                        placeholder="your-secret-api-key"
                                        value={config.API_KEY}
                                        onChange={(e) => setConfig({ ...config, API_KEY: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#6b5b52] uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <Mail size={12} />
                                        Email Domain
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-[#fffdf8] border border-[#ead8c5] rounded-xl focus:ring-2 focus:ring-[#d59b46]/40 outline-none text-sm"
                                        placeholder="example.com"
                                        value={config.EMAIL_DOMAIN}
                                        onChange={(e) => setConfig({ ...config, EMAIL_DOMAIN: e.target.value })}
                                        required
                                    />
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 bg-gradient-to-r from-[#1f6a5c] to-[#2f8f7b] hover:from-[#1a5a4e] hover:to-[#287a6b] text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Settings size={18} />
                                            <span>Lưu cấu hình</span>
                                        </>
                                    )}
                                </motion.button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {/* Footer hint */}
                    <p className="text-center text-[#a58b78] text-xs mt-6">
                        {activeTab === 'login'
                            ? 'Liên hệ admin nếu bạn chưa có API Key'
                            : 'Lấy Bot Token từ @BotFather trên Telegram'
                        }
                    </p>
                </div>
            </motion.div>
        </motion.div>
    )
}
