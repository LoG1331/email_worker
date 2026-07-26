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

export function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'N/A'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const maximumFractionDigits = size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} ${units[unitIndex]}`
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

const FIELD_LABELS = {
  apiKey: 'API key',
  color: 'Màu',
  currentPassword: 'Mật khẩu hiện tại',
  description: 'Mô tả',
  displayName: 'Tên hiển thị',
  domain: 'Domain',
  emailAddress: 'Địa chỉ mail',
  emailAddresses: 'Địa chỉ mail',
  emailIds: 'Danh sách mail',
  inboundEnabled: 'Nhận thư',
  isDefault: 'Mặc định',
  limit: 'Giới hạn',
  name: 'Tên',
  newPassword: 'Mật khẩu mới',
  olderThanDays: 'Số ngày',
  ownerUserId: 'Người sở hữu',
  password: 'Mật khẩu',
  pattern: 'Người gửi',
  patternType: 'Kiểu chặn',
  publicBaseUrl: 'Public base URL',
  reason: 'Lý do',
  status: 'Trạng thái',
  telegramId: 'Telegram ID',
  userId: 'Người dùng',
  username: 'Tên đăng nhập',
}

function fieldLabel(path) {
  const key = Array.isArray(path) ? path.find((part) => typeof part === 'string') : path
  if (!key) {
    return ''
  }

  return FIELD_LABELS[key] || key
}

/**
 * Zod phát message tiếng Anh kỹ thuật ("Too small: expected string to have >=8
 * characters"). Đổi các dạng phổ biến sang tiếng Việt, giữ nguyên phần còn lại
 * vì message do backend tự đặt (HttpError) thường đã đủ rõ.
 */
function humanizeIssueMessage(message, issue) {
  const raw = String(message || '').trim()

  if (issue?.code === 'invalid_type' && /received undefined|received null/i.test(raw)) {
    return 'Không được để trống'
  }

  const tooSmall = raw.match(/expected \w+ to have >=(\d+) characters?/i)
  if (tooSmall) {
    return `Phải có ít nhất ${tooSmall[1]} ký tự`
  }

  const tooBig = raw.match(/expected \w+ to have <=(\d+) characters?/i)
  if (tooBig) {
    return `Không được vượt quá ${tooBig[1]} ký tự`
  }

  if (/expected array to have >=(\d+)/i.test(raw)) {
    return 'Cần chọn ít nhất một mục'
  }

  return raw
}

/**
 * Backend trả `details` là mảng Zod issue cho lỗi 400, hoặc object tuỳ ngữ cảnh.
 * Chuẩn hoá về danh sách { field, label, message } để form hiển thị inline.
 */
export function getApiErrorIssues(error) {
  const details = error?.details
  if (!details) {
    return []
  }

  if (Array.isArray(details)) {
    return details
      .map((issue) => {
        const message = String(issue?.message || '').trim()
        if (!message) {
          return null
        }

        const path = issue?.path
        const key = Array.isArray(path) ? path.find((part) => typeof part === 'string') : path

        return {
          field: key || '',
          label: fieldLabel(path),
          message: humanizeIssueMessage(message, issue),
        }
      })
      .filter(Boolean)
  }

  if (typeof details === 'object') {
    return Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .map(([key, value]) => ({
        field: key,
        label: fieldLabel(key),
        message: String(value),
      }))
  }

  return []
}

/**
 * Lấy thông điệp lỗi cho một field cụ thể để render ngay dưới input.
 * `fields` có thể là nhiều tên khi backend chấp nhận nhiều cách nhập cùng một thứ.
 */
export function findIssueMessage(error, fields) {
  const wanted = Array.isArray(fields) ? fields : [fields]
  const issue = getApiErrorIssues(error).find((item) => wanted.includes(item.field))
  return issue?.message || ''
}

export function formatApiError(error) {
  if (!error) {
    return 'Lỗi không xác định'
  }

  if (!error.message) {
    return String(error)
  }

  const issues = getApiErrorIssues(error)
  const summary = issues.length
    ? `${error.message}: ${issues
      .slice(0, 3)
      .map((issue) => (issue.label ? `${issue.label} — ${issue.message}` : issue.message))
      .join('; ')}${issues.length > 3 ? `; +${issues.length - 3} lỗi khác` : ''}`
    : error.message

  return error.requestId ? `${summary} · ${error.requestId}` : summary
}

export function getPermissionScopeLabel(permission) {
  if (!permission) {
    return ''
  }

  return permission.domain || ''
}

export function truncate(value, maxLength = 120) {
  const text = String(value || '')
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}…`
}
