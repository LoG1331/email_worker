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
            className="glass-panel p-6 rounded-[2rem] mb-10 flex items-center justify-between border-none"
        >
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                    <Mail className="text-white" size={28} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black tracking-tight text-slate-800">
                            Email Management
                        </h1>
                        <div className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">PRO</span>
                        </div>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">
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
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : setupResult === false
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100'
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
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-red-600 hover:border-red-200 transition-all duration-300 font-bold text-sm uppercase tracking-wide"
                    >
                        <LogOut size={16} />
                        <span>Đăng xuất</span>
                    </motion.button>
                </div>
            )}
        </motion.header>
    )
}
