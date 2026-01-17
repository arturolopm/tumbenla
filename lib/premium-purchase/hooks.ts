import { useQuery, useMutation } from '@tanstack/react-query'

interface VerifySessionResponse {
  success: boolean
  sessionId: string
  paymentStatus: string
}

interface CheckoutResponse {
  url: string
}

export function useVerifyPremiumPurchase(sessionId: string | null) {
  return useQuery({
    queryKey: ['premium-purchase-verify', sessionId],
    queryFn: async () => {
      if (!sessionId) {
        throw new Error('No session ID provided')
      }

      const res = await fetch(`/api/premium-purchase/verify?session_id=${sessionId}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Payment verification failed')
      }

      const data: VerifySessionResponse = await res.json()
      if (!data.success) {
        throw new Error('Payment verification failed')
      }

      return data
    },
    enabled: !!sessionId,
    retry: false,
  })
}

export function usePremiumCheckout() {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/premium-purchase/checkout', {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const data: CheckoutResponse = await res.json()
      if (!data.url) {
        throw new Error('No checkout URL received')
      }

      return data
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url
      }
    },
  })

  return {
    checkout: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}
