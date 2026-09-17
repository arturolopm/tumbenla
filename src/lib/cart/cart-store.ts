import { persist, type PersistStorage, type StateStorage } from 'zustand/middleware'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'

export const CART_STORAGE_NAME = 'tumbenla:bar-carts:v1'
export const CART_STORAGE_VERSION = 1
export const MAX_CART_UNITS = 20

export type CartLineInput = {
  productId: string
  quantity: number
}

type StoredBarCart = {
  lines: CartLineInput[]
  submissionKey: string
  revision: number
  fingerprint: string
}

export type BarCart = StoredBarCart

export type CartMutationFailureReason =
  | 'invalid-venue-id'
  | 'invalid-product-id'
  | 'invalid-quantity'
  | 'cart-limit-exceeded'
  | 'fingerprint-mismatch'

export type CartMutationResult =
  | {
      ok: true
      changed: true
      cart: BarCart | null
    }
  | {
      ok: true
      changed: false
      cart: BarCart | null
    }
  | {
      ok: false
      changed: false
      cart: BarCart | null
      reason: CartMutationFailureReason
    }

type HydrationState = {
  hasHydrated: boolean
  hydrationError: boolean
}

export type BarCartStore = HydrationState & {
  carts: Record<string, StoredBarCart>
  getCart: (venueId: string) => BarCart | null
  ensureSeededProduct: (venueId: string, productId: string) => CartMutationResult
  addUnit: (venueId: string, productId: string) => CartMutationResult
  setQuantity: (venueId: string, productId: string, quantity: number) => CartMutationResult
  removeProduct: (venueId: string, productId: string) => CartMutationResult
  rotateSubmissionKey: (venueId: string) => CartMutationResult
  clearVenueCart: (venueId: string, expectedFingerprint: string) => CartMutationResult
}

export type BarCartStoreApi = StoreApi<BarCartStore> & {
  persist: {
    rehydrate: () => Promise<void> | void
    hasHydrated: () => boolean
    clearStorage: () => void
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const normalizeLines = (lines: readonly CartLineInput[]): CartLineInput[] | null => {
  if (!Array.isArray(lines)) return null

  const quantities = new Map<string, number>()
  for (const line of lines) {
    if (!isRecord(line)) return null
    const productId = normalizeId(line.productId)
    if (!productId || !isPositiveInteger(line.quantity)) return null
    quantities.set(productId, (quantities.get(productId) ?? 0) + line.quantity)
  }

  const normalized = [...quantities.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([productId, quantity]) => ({ productId, quantity }))
  return normalized.every((line) => Number.isSafeInteger(line.quantity)) ? normalized : null
}

const countUnits = (lines: readonly CartLineInput[]) =>
  lines.reduce((total, line) => total + line.quantity, 0)

/** Return a deterministic fingerprint containing no client-provided money. */
export const cartFingerprint = (lines: readonly CartLineInput[]): string => {
  const normalized = normalizeLines(lines)
  if (!normalized) throw new TypeError('Cart lines must contain valid product IDs and quantities')
  return JSON.stringify(normalized)
}

const cloneCart = (cart: StoredBarCart): BarCart => ({
  lines: cart.lines.map((line) => ({ ...line })),
  submissionKey: cart.submissionKey,
  revision: cart.revision,
  fingerprint: cart.fingerprint,
})

const generateSubmissionKey = () => globalThis.crypto.randomUUID()

const nextSubmissionKey = (previous: string) => {
  let submissionKey = generateSubmissionKey()
  while (submissionKey === previous) submissionKey = generateSubmissionKey()
  return submissionKey
}

const createCart = (lines: CartLineInput[], previous?: StoredBarCart): StoredBarCart => ({
  lines,
  submissionKey: previous ? nextSubmissionKey(previous.submissionKey) : generateSubmissionKey(),
  revision: previous ? previous.revision + 1 : 1,
  fingerprint: cartFingerprint(lines),
})

const noOp = (cart?: StoredBarCart): CartMutationResult => ({
  ok: true,
  changed: false,
  cart: cart ? cloneCart(cart) : null,
})

const rejected = (reason: CartMutationFailureReason, cart?: StoredBarCart): CartMutationResult => ({
  ok: false,
  changed: false,
  cart: cart ? cloneCart(cart) : null,
  reason,
})

const changed = (cart: StoredBarCart): CartMutationResult => ({
  ok: true,
  changed: true,
  cart: cloneCart(cart),
})

const sanitizeCarts = (value: unknown): Record<string, StoredBarCart> => {
  if (!isRecord(value)) return {}
  const source = isRecord(value.carts) ? value.carts : value
  const carts: Record<string, StoredBarCart> = {}

  for (const [rawVenueId, rawCart] of Object.entries(source)) {
    const venueId = normalizeId(rawVenueId)
    if (!venueId || !isRecord(rawCart)) continue

    const lines = normalizeLines(rawCart.lines as CartLineInput[])
    if (!lines || lines.length === 0 || countUnits(lines) > MAX_CART_UNITS) continue

    const rawRevision = rawCart.revision
    const revision = isPositiveInteger(rawRevision) ? rawRevision : 1
    const rawSubmissionKey = rawCart.submissionKey
    const submissionKey =
      typeof rawSubmissionKey === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        rawSubmissionKey
      )
        ? rawSubmissionKey
        : generateSubmissionKey()

    carts[venueId] = {
      lines,
      submissionKey,
      revision,
      fingerprint: cartFingerprint(lines),
    }
  }

  return carts
}

type PersistedValue = {
  state: unknown
  version?: number
}

const parsePersistedValue = (raw: string | null): PersistedValue | null => {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) && 'state' in parsed ? (parsed as PersistedValue) : null
  } catch {
    return null
  }
}

const createSafePersistStorage = (storage: StateStorage): PersistStorage<unknown> => ({
  getItem: (name) => {
    try {
      const raw = storage.getItem(name)
      return raw instanceof Promise
        ? raw.then(parsePersistedValue).catch(() => null)
        : parsePersistedValue(raw)
    } catch {
      return null
    }
  },
  setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => storage.removeItem(name),
})

const browserStorage: StateStorage = {
  getItem: (name) => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name)
  },
}

export const createBarCartStore = (storage?: StateStorage): BarCartStoreApi => {
  let updateHydration: (hasHydrated: boolean, hasError: boolean) => void = () => undefined
  const persistStorage = createSafePersistStorage(storage ?? browserStorage)

  const store = createStore<BarCartStore>()(
    persist(
      (set, get) => {
        updateHydration = (hasHydrated, hasError) => set({ hasHydrated, hydrationError: hasError })

        const mutateLines = (
          venueIdInput: string,
          productIdInput: string,
          getLines: (current: CartLineInput[]) => CartLineInput[] | null
        ): CartMutationResult => {
          const venueId = normalizeId(venueIdInput)
          const productId = normalizeId(productIdInput)
          const current = venueId ? get().carts[venueId] : undefined
          if (!venueId) return rejected('invalid-venue-id', current)
          if (!productId) return rejected('invalid-product-id', current)

          const currentLines = current?.lines ?? []
          const nextLines = getLines(currentLines.map((line) => ({ ...line })))
          if (!nextLines) return rejected('invalid-quantity', current)
          if (countUnits(nextLines) > MAX_CART_UNITS) {
            return rejected('cart-limit-exceeded', current)
          }

          const normalizedLines = normalizeLines(nextLines)
          if (!normalizedLines) return rejected('invalid-quantity', current)
          if (normalizedLines.length === 0) {
            if (!current) return noOp()
            const { [venueId]: _removed, ...remaining } = get().carts
            set({ carts: remaining })
            return { ok: true, changed: true, cart: null }
          }
          const nextFingerprint = cartFingerprint(normalizedLines)
          if (current && nextFingerprint === current.fingerprint) return noOp(current)

          const nextCart = createCart(normalizedLines, current)
          set({ carts: { ...get().carts, [venueId]: nextCart } })
          return changed(nextCart)
        }

        return {
          carts: {},
          hasHydrated: false,
          hydrationError: false,
          getCart: (venueIdInput) => {
            const venueId = normalizeId(venueIdInput)
            const cart = venueId ? get().carts[venueId] : undefined
            return venueId && cart ? cloneCart(cart) : null
          },
          ensureSeededProduct: (venueIdInput, productIdInput) =>
            mutateLines(venueIdInput, productIdInput, (lines) => {
              if (lines.some((line) => line.productId === normalizeId(productIdInput))) return lines
              return [...lines, { productId: normalizeId(productIdInput) ?? '', quantity: 1 }]
            }),
          addUnit: (venueIdInput, productIdInput) =>
            mutateLines(venueIdInput, productIdInput, (lines) => {
              const productId = normalizeId(productIdInput)
              if (!productId) return null
              const existing = lines.find((line) => line.productId === productId)
              if (!existing) return [...lines, { productId, quantity: 1 }]
              if (!isPositiveInteger(existing.quantity + 1)) return null
              return lines.map((line) =>
                line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line
              )
            }),
          setQuantity: (venueIdInput, productIdInput, quantity) =>
            mutateLines(venueIdInput, productIdInput, (lines) => {
              if (!isPositiveInteger(quantity)) return null
              const productId = normalizeId(productIdInput)
              if (!productId) return null
              const existing = lines.find((line) => line.productId === productId)
              if (!existing) return [...lines, { productId, quantity }]
              return lines.map((line) =>
                line.productId === productId ? { ...line, quantity } : line
              )
            }),
          removeProduct: (venueIdInput, productIdInput) =>
            mutateLines(venueIdInput, productIdInput, (lines) => {
              const productId = normalizeId(productIdInput)
              if (!productId || !lines.some((line) => line.productId === productId)) return lines
              return lines.filter((line) => line.productId !== productId)
            }),
          rotateSubmissionKey: (venueIdInput) => {
            const venueId = normalizeId(venueIdInput)
            if (!venueId) return rejected('invalid-venue-id')
            const current = get().carts[venueId]
            if (!current) return noOp()
            const nextCart: StoredBarCart = {
              ...current,
              submissionKey: nextSubmissionKey(current.submissionKey),
              revision: current.revision + 1,
            }
            set({ carts: { ...get().carts, [venueId]: nextCart } })
            return changed(nextCart)
          },
          clearVenueCart: (venueIdInput, expectedFingerprint) => {
            const venueId = normalizeId(venueIdInput)
            if (!venueId) return rejected('invalid-venue-id')
            const current = get().carts[venueId]
            if (!current) return noOp()
            if (
              typeof expectedFingerprint !== 'string' ||
              expectedFingerprint !== current.fingerprint
            ) {
              return rejected('fingerprint-mismatch', current)
            }
            const { [venueId]: _removed, ...remaining } = get().carts
            set({ carts: remaining })
            return { ok: true, changed: true, cart: null }
          },
        }
      },
      {
        name: CART_STORAGE_NAME,
        version: CART_STORAGE_VERSION,
        storage: persistStorage,
        skipHydration: true,
        partialize: (state) => ({ carts: state.carts }),
        merge: (persistedState, currentState) => ({
          ...currentState,
          carts: sanitizeCarts(persistedState),
        }),
        migrate: (persistedState) => ({ carts: sanitizeCarts(persistedState) }),
        onRehydrateStorage: () => (_state, error) => {
          updateHydration(true, Boolean(error))
        },
      }
    )
  )

  return store as BarCartStoreApi
}

export const barCartStore = createBarCartStore()
export const useBarCartStore = <T = BarCartStore>(
  selector: (state: BarCartStore) => T = (state) => state as T
): T => useStore(barCartStore, selector)
