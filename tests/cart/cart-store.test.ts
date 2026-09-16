import { describe, expect, test } from 'bun:test'
import type { StateStorage } from 'zustand/middleware'
import {
  CART_STORAGE_NAME,
  MAX_CART_UNITS,
  cartFingerprint,
  createBarCartStore,
} from '@/lib/cart/cart-store'

const makeStorage = (initial?: string): { storage: StateStorage; values: Map<string, string> } => {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(CART_STORAGE_NAME, initial)
  return {
    values,
    storage: {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => void values.set(name, value),
      removeItem: (name) => void values.delete(name),
    },
  }
}

const rehydrate = async (storage: StateStorage) => {
  const store = createBarCartStore(storage)
  await store.persist.rehydrate()
  return store
}

describe('bar cart store', () => {
  test('keeps carts separated by venue', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)

    store.getState().addUnit('bar-a', 'beer')
    store.getState().addUnit('bar-b', 'beer')
    store.getState().addUnit('bar-b', 'beer')

    expect(store.getState().getCart('bar-a')?.lines).toEqual([{ productId: 'beer', quantity: 1 }])
    expect(store.getState().getCart('bar-b')?.lines).toEqual([{ productId: 'beer', quantity: 2 }])
  })

  test('persists and rehydrates only the cart contract', async () => {
    const { storage, values } = makeStorage()
    const first = await rehydrate(storage)
    first.getState().addUnit('bar-a', 'beer')

    const persisted = JSON.parse(values.get(CART_STORAGE_NAME) ?? '{}')
    expect(persisted.state.carts['bar-a']).toEqual(
      first.getState().getCart('bar-a') && {
        lines: [{ productId: 'beer', quantity: 1 }],
        submissionKey: first.getState().getCart('bar-a')?.submissionKey,
        revision: 1,
        fingerprint: cartFingerprint([{ productId: 'beer', quantity: 1 }]),
      }
    )
    expect(JSON.stringify(persisted)).not.toContain('price')
    expect(JSON.stringify(persisted)).not.toContain('name')
    expect(JSON.stringify(persisted)).not.toContain('split')

    const second = await rehydrate(storage)
    expect(second.getState().getCart('bar-a')).toEqual(first.getState().getCart('bar-a'))
    expect(second.getState().hasHydrated).toBe(true)
  })

  test('seeding is idempotent and does not rotate an existing line', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)
    const first = store.getState().ensureSeededProduct('bar-a', 'beer')
    const cart = store.getState().getCart('bar-a')
    const second = store.getState().ensureSeededProduct('bar-a', 'beer')

    expect(first).toMatchObject({ ok: true, changed: true })
    expect(second).toMatchObject({ ok: true, changed: false })
    expect(store.getState().getCart('bar-a')).toEqual(cart)
  })

  test('adds, sets, and removes product lines', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)

    expect(store.getState().addUnit('bar-a', 'beer')).toMatchObject({ ok: true, changed: true })
    expect(store.getState().addUnit('bar-a', 'beer')).toMatchObject({ ok: true, changed: true })
    expect(store.getState().setQuantity('bar-a', 'beer', 4)).toMatchObject({
      ok: true,
      changed: true,
    })
    expect(store.getState().setQuantity('bar-a', 'beer', 4)).toMatchObject({
      ok: true,
      changed: false,
    })
    expect(store.getState().removeProduct('bar-a', 'beer')).toMatchObject({
      ok: true,
      changed: true,
      cart: null,
    })
    expect(store.getState().getCart('bar-a')).toBeNull()
  })

  test('accepts exactly 20 units and rejects the 21st without mutation', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)
    const accepted = store.getState().setQuantity('bar-a', 'beer', MAX_CART_UNITS)
    const before = store.getState().getCart('bar-a')
    const rejected = store.getState().addUnit('bar-a', 'wine')

    expect(accepted).toMatchObject({ ok: true, changed: true })
    expect(rejected).toMatchObject({ ok: false, reason: 'cart-limit-exceeded' })
    expect(store.getState().getCart('bar-a')).toEqual(before)
    expect(store.getState().setQuantity('bar-a', 'beer', MAX_CART_UNITS + 1)).toMatchObject({
      ok: false,
      reason: 'cart-limit-exceeded',
    })
  })

  test('rotates submission keys only for actual mutations', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)
    store.getState().addUnit('bar-a', 'beer')
    const initial = store.getState().getCart('bar-a')
    const noOp = store.getState().setQuantity('bar-a', 'beer', 1)
    const beforeRotate = store.getState().getCart('bar-a')
    const rotated = store.getState().rotateSubmissionKey('bar-a')
    const after = store.getState().getCart('bar-a')

    expect(noOp).toMatchObject({ ok: true, changed: false })
    expect(beforeRotate).toEqual(initial)
    expect(rotated).toMatchObject({ ok: true, changed: true })
    expect(after?.revision).toBe((initial?.revision ?? 0) + 1)
    expect(after?.submissionKey).not.toBe(initial?.submissionKey)
    expect(store.getState().rotateSubmissionKey('missing')).toMatchObject({
      ok: true,
      changed: false,
    })
  })

  test('fingerprints are stable across line object and array ordering', () => {
    const first = cartFingerprint([
      { productId: 'wine', quantity: 2 },
      { productId: 'beer', quantity: 1 },
    ])
    const second = cartFingerprint([
      { quantity: 1, productId: 'beer' },
      { productId: 'wine', quantity: 1 },
      { productId: 'wine', quantity: 1 },
    ])

    expect(first).toBe(second)
  })

  test('conditional clear protects a newer cart', async () => {
    const { storage } = makeStorage()
    const store = await rehydrate(storage)
    store.getState().addUnit('bar-a', 'beer')
    const oldFingerprint = store.getState().getCart('bar-a')?.fingerprint ?? ''
    store.getState().addUnit('bar-a', 'wine')

    expect(store.getState().clearVenueCart('bar-a', oldFingerprint)).toMatchObject({
      ok: false,
      reason: 'fingerprint-mismatch',
    })
    expect(store.getState().getCart('bar-a')).not.toBeNull()
    const currentFingerprint = store.getState().getCart('bar-a')?.fingerprint ?? ''
    expect(store.getState().clearVenueCart('bar-a', currentFingerprint)).toMatchObject({
      ok: true,
      changed: true,
      cart: null,
    })
    expect(store.getState().getCart('bar-a')).toBeNull()
  })

  test('sanitizes malformed persisted cart data', async () => {
    const malformed = JSON.stringify({
      state: {
        carts: {
          good: {
            lines: [
              { productId: 'beer', quantity: 1 },
              { productId: 'beer', quantity: 2 },
            ],
            submissionKey: 'persisted-key',
            revision: 'not-a-number',
            fingerprint: 'forged',
            displayName: 'should be discarded',
          },
          empty: { lines: [], submissionKey: 'unused', revision: 1, fingerprint: 'empty' },
          broken: { lines: [{ productId: '', quantity: 2 }], submissionKey: 'unused' },
          tooLarge: { lines: [{ productId: 'beer', quantity: 21 }], submissionKey: 'unused' },
        },
      },
      version: 1,
    })
    const { storage } = makeStorage(malformed)
    const store = await rehydrate(storage)
    const cart = store.getState().getCart('good')

    expect(cart?.lines).toEqual([{ productId: 'beer', quantity: 3 }])
    expect(cart?.revision).toBe(1)
    expect(cart?.fingerprint).toBe(cartFingerprint(cart?.lines ?? []))
    expect(store.getState().getCart('empty')).toBeNull()
    expect(store.getState().getCart('broken')).toBeNull()
    expect(store.getState().getCart('tooLarge')).toBeNull()
  })

  test('creates safely without browser storage during SSR', () => {
    expect(() => createBarCartStore()).not.toThrow()
    const store = createBarCartStore()
    expect(store.getState().hasHydrated).toBe(false)
    expect(store.getState().getCart('bar-a')).toBeNull()
  })

  test('finishes hydration with an empty cart when storage cannot be read', async () => {
    const store = createBarCartStore({
      getItem: () => {
        throw new Error('storage blocked')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    })

    await store.persist.rehydrate()

    expect(store.getState().hasHydrated).toBe(true)
    expect(store.getState().getCart('bar-a')).toBeNull()
  })
})
