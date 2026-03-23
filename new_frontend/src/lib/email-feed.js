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

export function getEmailPreview(email) {
  const preview = getEmailBodyText(email)

  if (!preview) {
    return email?.html ? 'Email này có nội dung HTML.' : 'Không có preview text cho email này.'
  }

  return truncate(preview, 180)
}
