import { StripeAdapter } from './providers/stripe'
import type { PaymentProvider } from './types'

// β版・初月はStripeアダプターのみ実装（他社（SBPayment/PayPay等）は将来追加・v3.4第3章）
export const PAYMENT_PROVIDER_NAME = 'stripe' as const

export const paymentProvider: PaymentProvider = new StripeAdapter()

export * from './types'
