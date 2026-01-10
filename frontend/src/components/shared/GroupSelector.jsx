import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'

export default function GroupSelector({
    emailAddress,
    apiKey,
    onGroupToggle,
    idKey,
    activeKey,
    setActiveKey
}) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [groups, setGroups] = useState([])
    const [emailGroups, setEmailGroups] = useState([])
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
    const buttonRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showDropdown) {
                setShowDropdown(false)
                setActiveKey?.(null)
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [showDropdown, setActiveKey])

    useEffect(() => {
        if (apiKey) {
            loadGroups()
        }
    }, [apiKey])

    // Close if another dropdown is opened
    useEffect(() => {
        const key = idKey || emailAddress
        if (activeKey && activeKey !== key) {
            setShowDropdown(false)
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
            // Silent fail
        }
    }

    const loadEmailGroups = async () => {
        try {
            const response = await fetch(`/api/emails/${encodeURIComponent(emailAddress)}/groups`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (response.ok) {
                const data = await response.json()
                setEmailGroups(data.groups || [])
            }
        } catch {
            // Silent fail
        }
    }

    const toggleDropdown = async (e) => {
        e.stopPropagation()
        const key = idKey || emailAddress
        if (showDropdown) {
            setShowDropdown(false)
            setActiveKey?.(null)
        } else {
            // Calculate position
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect()
                setDropdownPosition({
                    top: rect.bottom + 10,
                    left: rect.left - 8
                })
            }
            setActiveKey?.(key)
            setShowDropdown(true)
            await loadEmailGroups()
        }
    }

    const toggleEmailInGroup = async (groupId, isInGroup) => {
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
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Group toggle failed:', errorData);
                // We don't want to show toast here if we want it to be silent, 
                // but for debugging crash issues it's better to log.
            }
        } catch (error) {
            console.error('Error toggling email in group:', error);
        }
    }

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#fff8ef] border border-[#ead8c5] text-[#c5532d] hover:border-[#d59b46] hover:shadow-sm transition-all"
                title="Chọn nhóm"
            >
                <Star
                    size={16}
                    fill={emailGroups.length > 0 ? "currentColor" : "none"}
                />
                <span className="text-xs font-bold text-[#6b5b52]">Chọn nhóm</span>
            </button>

            {/* Group Dropdown - Fixed positioning */}
            {showDropdown && (
                <div
                    className="fixed bg-[#fff8ef] rounded-2xl shadow-2xl border border-[#ead8c5] p-5 z-[9999] min-w-[280px] max-h-[420px] overflow-y-auto"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-black text-[#6b5b52] uppercase tracking-wider">
                            Chọn nhóm
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowDropdown(false)
                                setActiveKey?.(null)
                            }}
                            className="text-[#9c8573] hover:text-[#6b5b52]"
                        >
                            ✕
                        </button>
                    </div>
                    {(!groups || !Array.isArray(groups) || groups.length === 0) ? (
                        <div className="text-xs text-[#9c8573] py-2">
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
                                            onChange={() => toggleEmailInGroup(group.id, isInGroup)}
                                            className="w-5 h-5 rounded border-[#cdb8a3] text-[#c5532d]"
                                        />
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: group.color }}
                                        />
                                        <span className="text-sm font-bold text-[#2a1f1a]">
                                            {group.name}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
