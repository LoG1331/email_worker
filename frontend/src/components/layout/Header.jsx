import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, LogOut, Bot, Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Header({ onLogout, showLogout, apiKey }) {
    const [setupLoading, setSetupLoading] = useState(false)
    const [setupResult, setSetupResult] = useState(null)

    const handleSetupTelegram = async () => {
        setSetupLoading(true)
        setSetupResult(null)
        try {
            const res = await fetch('/api/setup-telegram', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            const data = await res.json()
            setSetupResult(data.success)
            if (data.success) {
                toast.success('Telegram bot đã được setup!')
            } else {
                toast.error('Setup thất bại: ' + (data.webhook || data.commands))
            }
        } catch {
            setSetupResult(false)
            toast.error('Lỗi kết nối')
        } finally {
            setSetupLoading(false)
            setTimeout(() => setSetupResult(null), 3000)
        }
    }

    return (
        <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-[2rem] mb-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-none"
        >
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-[#1f6a5c] rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                    <Mail className="text-white" size={28} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink font-display">
                            Email Management
                        </h1>
                        <div className="px-2 py-0.5 bg-[#f3e3cf] border border-[#e7c8a6] rounded-md">
                            <span className="text-[10px] font-bold text-[#c5532d] uppercase tracking-widest">STUDIO</span>
                        </div>
                    </div>
                    <p className="text-muted font-medium text-sm">
                        Quản lý email hệ thống
                    </p>
                </div>
            </div>

            {showLogout && (
                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSetupTelegram}
                        disabled={setupLoading}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${setupResult === true
                                ? 'bg-[#def3e6] text-[#1f6a5c] border border-[#bfe1cd]'
                                : setupResult === false
                                    ? 'bg-[#f8d9d9] text-[#b63b3b] border border-[#f0bcbc]'
                                    : 'bg-[#efe1d2] border border-[#e4cbb0] text-[#6b5b52] hover:bg-[#f6e9dc]'
                            }`}
                    >
                        {setupLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : setupResult === true ? (
                            <Check size={16} />
                        ) : setupResult === false ? (
                            <X size={16} />
                        ) : (
                            <Bot size={16} />
                        )}
                        <span className="hidden sm:inline">Setup Bot</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onLogout}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#fff8ef] border border-[#e6d6c4] rounded-xl text-[#6b5b52] hover:text-[#b63b3b] hover:border-[#e8b3b3] transition-all duration-300 font-bold text-sm uppercase tracking-wide"
                    >
                        <LogOut size={16} />
                        <span>Đăng xuất</span>
                    </motion.button>
                </div>
            )}
        </motion.header>
    )
}
