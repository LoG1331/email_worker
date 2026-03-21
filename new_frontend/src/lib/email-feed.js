import { truncate } from './format.js'

export function getSenderLabel(email) {
  const name = String(email?.from?.name || '').trim()
  const address = String(email?.from?.address || email?.envelopeFrom || '').trim()

  if (name && address) {
    return `${name} <${address}>`
  }

  return name || address || 'Không rõ người gửi'
}

export function getEmailPreview(email) {
  const preview = String(email?.text || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!preview) {
    return 'Không có preview text cho email này.'
  }

  return truncate(preview, 180)
}
