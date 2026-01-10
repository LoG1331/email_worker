import { useState, useEffect } from 'react'
import { Star, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function GroupSelector({
    emailAddress,
    apiKey,
    onGroupToggle,
    idKey,
    activeKey,
    setActiveKey,
    initialGroupCount = 0
}) {
    const [showModal, setShowModal] = useState(false)
    const [groups, setGroups] = useState([])
    const [emailGroups, setEmailGroups] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (apiKey) {
            loadGroups()
        }
    }, [apiKey])

    // Close if another modal is opened
    useEffect(() => {
        const key = idKey || emailAddress
        if (activeKey && activeKey !== key) {
            setShowModal(false)
        }
    }, [activeKey, emailAddress, idKey])

    const loadGroups = async () => {
        try {
            const response = await fetch('/api/groups', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setGroups(data.groups || [])
            }
        } catch {
            toast.error('Lỗi tải danh sách nhóm')
        }
    }

    const loadEmailGroups = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/emails/${encodeURIComponent(emailAddress)}/groups`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setEmailGroups(data.groups || [])
            }
        } catch {
            toast.error('Lỗi tải nhóm của email')
        } finally {
            setLoading(false)
        }
    }

    const toggleModal = async (e) => {
        e.stopPropagation()
        const key = idKey || emailAddress
        if (showModal) {
            setShowModal(false)
            setActiveKey?.(null)
        } else {
            setActiveKey?.(key)
            setShowModal(true)
            await loadEmailGroups()
        }
    }

    const closeModal = () => {
        setShowModal(false)
        setActiveKey?.(null)
    }

    const toggleEmailInGroup = async (groupId, isInGroup, groupName) => {
        try {
            const endpoint = isInGroup
                ? `/api/groups/${groupId}/emails/${encodeURIComponent(emailAddress)}`
                : `/api/groups/${groupId}/emails`;

            const options = {
                method: isInGroup ? 'DELETE' : 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (!isInGroup) {
                options.body = JSON.stringify({ emailAddress });
            }

            const response = await fetch(endpoint, options);

            if (response.ok) {
                await loadEmailGroups();
                if (onGroupToggle) {
                    onGroupToggle();
                }

                // Show toast notification
                if (isInGroup) {
                    toast.success(`Đã xóa khỏi nhóm "${groupName}"`)
                } else {
                    toast.success(`Đã thêm vào nhóm "${groupName}"`)
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.error || 'Lỗi thao tác nhóm')
            }
        } catch (error) {
            toast.error('Lỗi kết nối')
        }
    }

    return (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    toggleModal(e)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#fff8ef] border border-[#ead8c5] text-[#c5532d] hover:border-[#d59b46] hover:shadow-sm transition-all"
                title="Chọn nhóm"
            >
                <Star
                    size={16}
                    fill={(emailGroups.length > 0 || initialGroupCount > 0) ? "currentColor" : "none"}
                />
                <span className="text-xs font-bold text-[#6b5b52]">Chọn nhóm</span>
            </button>

            {/* Modal with backdrop */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation()
                        closeModal()
                    }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    {/* Modal content */}
                    <div
                        className="relative bg-[#fff8ef] rounded-2xl shadow-2xl border border-[#ead8c5] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4 pb-4 border-b border-[#ead8c5]">
                            <div>
                                <div className="text-sm font-black text-[#6b5b52] uppercase tracking-wider mb-2">
                                    Chọn nhóm
                                </div>
                                <div className="text-xs text-[#9c8573] break-all">
                                    {emailAddress}
                                </div>
                                {emailGroups.length > 0 && (
                                    <div className="text-xs text-[#c5532d] mt-1 font-semibold">
                                        ✓ Đã có {emailGroups.length} nhóm
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-[#9c8573] hover:text-[#6b5b52] transition-colors p-1 hover:bg-[#f6ecdf] rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Loading state */}
                        {loading ? (
                            <div className="text-center py-8 text-[#9c8573]">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c5532d] mx-auto mb-2"></div>
                                <div className="text-xs">Đang tải...</div>
                            </div>
                        ) : (!groups || !Array.isArray(groups) || groups.length === 0) ? (
                            <div className="text-sm text-[#9c8573] py-8 text-center">
                                Chưa có nhóm nào. Vào tab "Nhóm Email" để tạo nhóm.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {groups.map(group => {
                                    const isInGroup = Array.isArray(emailGroups) && emailGroups.some(g => g.id === group.id)
                                    return (
                                        <label
                                            key={group.id}
                                            className="flex items-center gap-3 cursor-pointer hover:bg-[#f6ecdf] p-3 rounded-xl transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isInGroup}
                                                onChange={() => toggleEmailInGroup(group.id, isInGroup, group.name)}
                                                className="w-5 h-5 rounded border-[#cdb8a3] text-[#c5532d] cursor-pointer"
                                            />
                                            <div
                                                className="w-4 h-4 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: group.color }}
                                            />
                                            <span className="text-sm font-bold text-[#2a1f1a] flex-1">
                                                {group.name}
                                            </span>
                                            {isInGroup && (
                                                <span className="text-xs text-[#c5532d] font-semibold">✓</span>
                                            )}
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
