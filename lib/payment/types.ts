export interface CustomerParams {
  metadata: Record<string, string>
}

export interface OneTimeChargeParams {
  amountYen: number
  customerId?: string
  metadata: Record<string, string>
}

export interface OneTimeChargeResult {
  providerChargeId: string
  clientSecret: string | null
}

export interface SubscriptionCheckoutParams {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}

export interface BillingPortalParams {
  customerId: string
  returnUrl: string
}

// 業者ごとに異なるWebhook形式を共通フォーマットへ変換した結果（第3章）
export type NormalizedWebhookEvent =
  | { kind: 'checkout_completed'; userId: string; plan: string }
  | { kind: 'subscription_updated'; userId: string; plan: string; active: boolean }
  | { kind: 'subscription_deleted'; userId: string }
  | { kind: 'charge_succeeded'; providerChargeId: string; metadata: Record<string, string> }
  | { kind: 'ignored' }

export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  readonly name: string
  createCustomer(params: CustomerParams): Promise<{ customerId: string }>
  createOneTimeCharge(params: OneTimeChargeParams): Promise<OneTimeChargeResult>
  createSubscriptionCheckout(params: SubscriptionCheckoutParams): Promise<{ url: string | null }>
  createBillingPortalSession(params: BillingPortalParams): Promise<{ url: string | null }>
  // 署名検証 + 共通フォーマットへの正規化（業者依存のWebhook検証ロジックをこの層に閉じ込める）
  verifyAndNormalizeWebhook(rawBody: string, signature: string | null): NormalizedWebhookEvent
}
