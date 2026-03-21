export function cn(...values) {
  return values.filter(Boolean).join(' ')
}

export function formatDateTime(value) {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRelativeTime(value) {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
  const absolute = Math.abs(deltaSeconds)

  if (absolute < 60) {
    return formatter.format(deltaSeconds, 'second')
  }

  const deltaMinutes = Math.round(deltaSeconds / 60)
  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, 'minute')
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, 'hour')
  }

  const deltaDays = Math.round(deltaHours / 24)
  return formatter.format(deltaDays, 'day')
}

export function parseIdList(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0)
}

export function normalizeOptional(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function formatApiError(error) {
  if (!error) {
    return 'Unknown error'
  }

  if (error.message) {
    return error.requestId ? `${error.message} · ${error.requestId}` : error.message
  }

  return String(error)
}

export function getPermissionScopeLabel(permission) {
  if (!permission) {
    return ''
  }

  return permission.emailAddress || permission.domain
}

export function truncate(value, maxLength = 120) {
  const text = String(value || '')
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}…`
}
