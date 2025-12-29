import { motion } from 'framer-motion'
import { X, User, Send, Calendar } from 'lucide-react'

export default function EmailDetailModal({ email, onClose }) {
    if (!email) return null

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
                transition={{ type: 'spring', duration: 0.3 }}
                className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-start justify-between gap-6">
                    <div className="flex-1">
                        <h2 className="text-2xl font-extrabold text-slate-800 mb-4 leading-tight">
                            {email.subject || '(Không có chủ đề)'}
                        </h2>
                        <div className="flex flex-wrap gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <User size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ</span>
                                    <span className="text-sm font-bold text-slate-700">{email.from?.address}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    <Send size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến</span>
                                    <span className="text-sm font-bold text-slate-700">{email.to}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center">
                                    <Calendar size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</span>
                                    <span className="text-sm font-bold text-slate-700">
                                        {new Date(email.receivedAt).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 w-12 h-12 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center transition-colors"
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8">
                    {email.html ? (
                        <div 
                            className="prose prose-slate max-w-none"
                            dangerouslySetInnerHTML={{ __html: email.html }}
                            style={{
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                            }}
                        />
                    ) : email.text ? (
                        <pre className="whitespace-pre-wrap font-sans text-slate-700 text-sm leading-relaxed">
                            {email.text}
                        </pre>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-slate-400 font-bold">Không có nội dung email</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}
