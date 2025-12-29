import { motion } from 'framer-motion'
import { Mail, BarChart3, Shield, Star } from 'lucide-react'

export default function Tabs({ activeTab, onTabChange }) {
    const tabs = [
        { id: 'starred', label: 'Nhóm Email', icon: Star },
        { id: 'emails', label: 'Tất cả Email', icon: Mail },
        { id: 'services', label: 'Dịch vụ', icon: BarChart3 },
        { id: 'permissions', label: 'Quyền', icon: Shield },
    ]

    return (
        <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit mb-10 shadow-inner border border-slate-200/50">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              relative flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300
              ${isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}
            `}
                    >
                        <Icon size={18} />
                        <span className="relative z-10">{tab.label}</span>

                        {isActive && (
                            <motion.div
                                layoutId="active-tab-bg-light"
                                className="absolute inset-0 bg-white shadow-md rounded-xl"
                                transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
                            />
                        )}
                    </button>
                )
            })}
        </div>
    )
}
