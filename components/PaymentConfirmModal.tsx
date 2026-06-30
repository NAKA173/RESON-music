'use client'

import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe-client'

interface PaymentConfirmModalProps {
  clientSecret: string
  title: string
  onSuccess: () => void
  onClose: () => void
}

export function PaymentConfirmModal({ clientSecret, title, onSuccess, onClose }: PaymentConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <Elements stripe={getStripeClient()} options={{ clientSecret }}>
          <ConfirmForm onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </div>
    </div>
  )
}

function ConfirmForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    setSubmitting(false)
    if (confirmError) {
      setError(confirmError.message ?? '決済に失敗しました')
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <form onSubmit={confirm} className="mt-4 space-y-3">
      <PaymentElement />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-40"
      >
        {submitting ? '処理中…' : '支払う'}
      </button>
    </form>
  )
}
