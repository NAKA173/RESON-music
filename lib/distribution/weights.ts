import type { UserPlan } from './types'

const PLAN_WEIGHTS: Record<UserPlan, number> = {
  support_plus: 1.3,
  standard: 1.0,
  student: 0.7,
  free: 0.4,
}

const AI_GENERATED_WEIGHT = 0.1

export function calcWeight(plan: UserPlan, aiGenerated: boolean): number {
  if (aiGenerated) return AI_GENERATED_WEIGHT
  return PLAN_WEIGHTS[plan]
}

export function calcSecFactor(playedSec: number, durationSec: number): number {
  if (playedSec < 30) return 0
  if (playedSec >= durationSec * 0.5) return 1.0
  return 0.5
}

// 月額プールへの各プランの寄与額（円/人）
export const POOL_CONTRIBUTION: Record<UserPlan, number> = {
  standard: 750 * 0.75,    // 562.5
  student: 250 * 0.8,      // 200
  support_plus: 1000 * 0.8, // 800
  free: 60 * 0.7,          // 42（広告収益）
}

// 投げ銭手数料率
export const TIP_FEE_RATE: Record<UserPlan, number> = {
  free: 0.15,
  standard: 0.08,
  student: 0.06,
  support_plus: 0.036, // Stripe実費のみ（月間一括）
}
