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
        <div className="flex p-1.5 bg-[#f1e3d4] rounded-2xl w-fit mb-10 shadow-inner border border-[#e2cdb5]">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              relative flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300
              ${isActive ? 'text-[#2a1f1a]' : 'text-[#6b5b52] hover:text-[#2a1f1a]'}
            `}
                    >
                        <Icon size={18} />
                        <span className="relative z-10">{tab.label}</span>

                        {isActive && (
                            <motion.div
                                layoutId="active-tab-bg-light"
                                className="absolute inset-0 bg-[#fff8ef] shadow-md rounded-xl border border-[#ead8c5]"
                                transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
                            />
                        )}
                    </button>
                )
            })}
        </div>
    )
}
