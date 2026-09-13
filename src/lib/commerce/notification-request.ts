import type { RawNotificationFields } from './gateways'

const MAX_NOTIFICATION_BYTES = 64 * 1024
const MAX_NOTIFICATION_FIELDS = 128

export class NotificationRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'NotificationRequestError'
    this.status = status
  }
}

const checkedContentLength = (request: Request): void => {
  const value = request.headers.get('content-length')
  if (!value) return
  const length = Number(value)
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_NOTIFICATION_BYTES) {
    throw new NotificationRequestError('Notification body is too large', 413)
  }
}

const addField = (
  fields: Record<string, string | readonly string[]>,
  key: string,
  value: string
): void => {
  const current = fields[key]
  if (current === undefined) fields[key] = value
  else if (typeof current === 'string') fields[key] = [current, value]
  else fields[key] = [...current, value]
}

const validateFields = (
  fields: Record<string, string | readonly string[]>,
  bytes: number
): RawNotificationFields => {
  if (bytes > MAX_NOTIFICATION_BYTES) {
    throw new NotificationRequestError('Notification body is too large', 413)
  }
  if (Object.keys(fields).length > MAX_NOTIFICATION_FIELDS) {
    throw new NotificationRequestError('Notification has too many fields', 413)
  }
  return fields
}

export const parseNotificationRequest = async (
  request: Request
): Promise<RawNotificationFields> => {
  checkedContentLength(request)
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  const fields: Record<string, string | readonly string[]> = {}

  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    const body = await request.text()
    const bytes = new TextEncoder().encode(body).byteLength
    for (const [key, value] of new URLSearchParams(body)) addField(fields, key, value)
    return validateFields(fields, bytes)
  }

  if (contentType.startsWith('multipart/form-data')) {
    const form = await request.formData()
    let bytes = 0
    for (const [key, value] of form) {
      if (typeof value !== 'string') {
        throw new NotificationRequestError('Notification files are not accepted', 415)
      }
      bytes += new TextEncoder().encode(key).byteLength + new TextEncoder().encode(value).byteLength
      addField(fields, key, value)
    }
    return validateFields(fields, bytes)
  }

  throw new NotificationRequestError('Unsupported notification content type', 415)
}
