import { truncate } from './format.js'

export function getSenderLabel(email) {
  const name = String(email?.from?.name || '').trim()
  const address = String(email?.from?.address || email?.envelopeFrom || '').trim()

  if (name && address) {
    return `${name} <${address}>`
  }

  return name || address || 'Không rõ người gửi'
}

export function getEmailBodyText(email) {
  return String(email?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Route danh sách chỉ trả `preview` (400 ký tự đầu) để payload không phình theo
 * số mail; route chi tiết vẫn trả `text` đầy đủ nên ưu tiên dùng nếu đã có.
 */
export function getEmailPreview(email) {
  const source = String(email?.text || email?.preview || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (source) {
    return truncate(source, 180)
  }

  const hasHtml = email?.hasHtml ?? Boolean(email?.html)
  return hasHtml ? 'Email này có nội dung HTML.' : 'Không có preview text cho email này.'
}
