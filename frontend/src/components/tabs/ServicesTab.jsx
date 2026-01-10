import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, Building2, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ServiceDetailModal from '../modals/ServiceDetailModal'

export default function ServicesTab({ apiKey, allServices, setAllServices }) {
    const [filteredServices, setFilteredServices] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedService, setSelectedService] = useState(null)
    const [deletingService, setDeletingService] = useState(null)

    useEffect(() => {
        if (apiKey && allServices.length === 0) {
            loadServices()
        }
    }, [apiKey])

    useEffect(() => {
        const query = searchQuery.toLowerCase()
        setFilteredServices(
            allServices.filter(service =>
                service.service.toLowerCase().includes(query)
            )
        )
    }, [searchQuery, allServices])

    const loadServices = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/all-services', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })

            if (response.ok) {
                const data = await response.json()
                setAllServices(data.services || [])
                toast.success(`Đã tải ${data.services?.length || 0} dịch vụ`)
            }
        } catch (error) {
            toast.error('Lỗi kết nối')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteService = async (serviceDomain) => {
        if (!confirm(`Xóa toàn bộ dịch vụ "${serviceDomain}"?\n\nĐiều này sẽ xóa tất cả tracking records của dịch vụ này.`)) {
            return
        }

        setDeletingService(serviceDomain)
        try {
            const response = await fetch(`/api/service/${encodeURIComponent(serviceDomain)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })

            if (response.ok) {
                toast.success('Đã xóa dịch vụ')
                setAllServices(prev => prev.filter(s => s.service !== serviceDomain))
            } else {
                toast.error('Lỗi xóa dịch vụ')
            }
        } catch (error) {
            toast.error('Lỗi kết nối')
        } finally {
            setDeletingService(null)
        }
    }

    const totalEmails = allServices.reduce((sum, s) => sum + s.totalEmails, 0)

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-20">
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-5 items-center p-4 rounded-3xl surface-panel">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8573]" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dịch vụ..."
                        className="w-full pl-12 pr-4 py-3 bg-[#fffdf8] border border-transparent rounded-2xl focus:ring-2 focus:ring-[#d59b46]/30 focus:border-[#d59b46] outline-none text-sm font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button onClick={loadServices} disabled={loading} className="btn-primary h-12 px-8 flex items-center gap-3">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                    { label: 'Tổng số dịch vụ', value: allServices.length, bg: 'bg-[#1f6a5c]', text: 'text-white' },
                    { label: 'Tổng emails tracked', value: totalEmails, bg: 'bg-[#fff8ef]', text: 'text-ink border border-[#ead8c5]' },
                ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} ${stat.text} p-8 rounded-[2.5rem] shadow-sm transform transition-transform hover:-translate-y-1`}>
                        <div className="text-sm font-black uppercase tracking-widest opacity-70 mb-2">{stat.label}</div>
                        <div className={`text-4xl font-black font-display`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* List */}
            <div className="space-y-4">
                {loading && allServices.length === 0 ? (
                    <div className="py-20 text-center">
                        <RefreshCw className="w-10 h-10 text-[#1f6a5c] animate-spin mx-auto mb-4" />
                        <p className="text-[#6b5b52] font-bold">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="surface-soft py-24 rounded-[3rem] text-center">
                        <Building2 size={64} className="mx-auto text-[#e2cdb5] mb-6" />
                        <p className="text-[#9c8573] font-bold text-lg">Không có dịch vụ nào</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        <AnimatePresence>
                            {filteredServices.map((service, idx) => (
                                <motion.div
                                    key={service.service}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className="group p-8 rounded-[2rem] border border-[#ead8c5] shadow-sm hover:shadow-xl hover:shadow-[#1f6a5c]/10 transition-all relative overflow-hidden surface-panel"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 bg-[#e8f2ed] text-[#1f6a5c] rounded-2xl flex items-center justify-center shrink-0">
                                            <Building2 size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-extrabold text-[#2a1f1a] group-hover:text-[#1f6a5c] transition-colors truncate font-display">
                                                {service.service}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1 text-sm font-bold text-[#9c8573]">
                                                <span className="text-[#c5532d]">{service.uniqueEmails} địa chỉ email</span>
                                                <span className="w-1 h-1 bg-[#d5c2ad] rounded-full" />
                                                <span>{service.totalEmails} tin nhắn</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <button
                                                onClick={() => setSelectedService(service)}
                                                className="h-12 px-6 rounded-2xl bg-[#f1e3d4] hover:bg-[#f6ecdf] text-[#6b5b52] font-bold flex items-center gap-2 transition-colors"
                                            >
                                                <Eye size={18} />
                                                <span className="hidden sm:inline">Chi tiết</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDeleteService(service.service)
                                                }}
                                                disabled={deletingService === service.service}
                                                className="w-12 h-12 rounded-2xl bg-[#f6dede] hover:bg-[#f2cfcf] text-[#b63b3b] flex items-center justify-center transition-colors disabled:opacity-50"
                                            >
                                                {deletingService === service.service ? (
                                                    <RefreshCw size={18} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Service Detail Modal */}
            <AnimatePresence>
                {selectedService && (
                    <ServiceDetailModal
                        service={selectedService}
                        onClose={() => setSelectedService(null)}
                        apiKey={apiKey}
                        onEmailDeleted={loadServices}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}
