import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'

export default function GroupSelector({
    emailAddress,
    apiKey,
    onGroupToggle
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
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [showDropdown])

    useEffect(() => {
        if (apiKey) {
            loadGroups()
        }
    }, [apiKey])

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
        if (showDropdown) {
            setShowDropdown(false)
        } else {
            // Calculate position
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect()
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left
                })
            }
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
                className="text-amber-400 hover:text-amber-500 transition-colors"
                title="Chọn nhóm"
            >
                <Star
                    size={14}
                    fill={emailGroups.length > 0 ? "currentColor" : "none"}
                />
            </button>

            {/* Group Dropdown - Fixed positioning */}
            {showDropdown && (
                <div
                    className="fixed bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-[9999] min-w-[250px] max-h-[400px] overflow-y-auto"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-black text-slate-600 uppercase tracking-wider">
                            Chọn nhóm
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowDropdown(false)
                            }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            ✕
                        </button>
                    </div>
                    {(!groups || !Array.isArray(groups) || groups.length === 0) ? (
                        <div className="text-xs text-slate-400 py-2">
                            Chưa có nhóm nào. Vào tab "Nhóm Email" để tạo nhóm.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groups.map(group => {
                                const isInGroup = Array.isArray(emailGroups) && emailGroups.some(g => g.id === group.id)
                                return (
                                    <label
                                        key={group.id}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isInGroup}
                                            onChange={() => toggleEmailInGroup(group.id, isInGroup)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                        />
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: group.color }}
                                        />
                                        <span className="text-sm font-medium text-slate-700">
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
