import { describe, expect, test } from 'bun:test'

import {
  NotificationRequestError,
  parseNotificationRequest,
} from '../../src/lib/commerce/notification-request'

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected request parsing to fail')
}

describe('commerce notification request parsing', () => {
  test('preserves exact strings and duplicate fields from form encoding', async () => {
    const request = new Request('https://example.test/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'x_amount=030000.00&x_ref_payco=0000123&x_ref_payco=second&x_currency_code=COP',
    })

    expect(await parseNotificationRequest(request)).toEqual({
      x_amount: '030000.00',
      x_ref_payco: ['0000123', 'second'],
      x_currency_code: 'COP',
    })
  })

  test('rejects unsupported content, files, excessive lengths, and excessive fields', async () => {
    const unsupported = await captureError(() =>
      parseNotificationRequest(
        new Request('https://example.test/webhook', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      )
    )
    expect(unsupported).toBeInstanceOf(NotificationRequestError)
    expect(unsupported).toMatchObject({ status: 415 })

    const tooLarge = await captureError(() =>
      parseNotificationRequest(
        new Request('https://example.test/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': String(64 * 1024 + 1),
          },
          body: 'x=1',
        })
      )
    )
    expect(tooLarge).toMatchObject({ status: 413 })

    const manyFields = new URLSearchParams()
    for (let index = 0; index < 129; index += 1) manyFields.set(`field_${index}`, 'value')
    const excessiveFields = await captureError(() =>
      parseNotificationRequest(
        new Request('https://example.test/webhook', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: manyFields,
        })
      )
    )
    expect(excessiveFields).toMatchObject({ status: 413 })

    const multipart = new FormData()
    multipart.set('attachment', new File(['payload'], 'payload.txt'))
    const file = await captureError(() =>
      parseNotificationRequest(
        new Request('https://example.test/webhook', { method: 'POST', body: multipart })
      )
    )
    expect(file).toMatchObject({ status: 415 })
  })
})
