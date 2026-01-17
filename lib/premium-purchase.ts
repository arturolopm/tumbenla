const STORAGE_KEY = 'shipfree_premium_purchased'

export const hasPurchasedPremium = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const setPurchasedPremium = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Ignore storage errors
  }
}

export const clearPurchaseStatus = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
