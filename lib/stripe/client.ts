import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

export type PlanId = 'standard' | 'student' | 'support_plus'

export const PLAN_PRICE_IDS: Record<PlanId, string> = {
  standard: process.env.STRIPE_PRICE_STANDARD!,
  student: process.env.STRIPE_PRICE_STUDENT!,
  support_plus: process.env.STRIPE_PRICE_SUPPORT_PLUS!,
}

export const PLAN_LABELS: Record<PlanId, string> = {
  standard: 'Standard',
  student: 'Student',
  support_plus: 'Support+',
}

export const PLAN_AMOUNTS: Record<PlanId, number> = {
  standard: 750,
  student: 250,
  support_plus: 1000,
}
