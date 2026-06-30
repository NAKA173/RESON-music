import { shouldNotifyBalance, isDormant, BALANCE_NOTIFY_THRESHOLD_YEN, DORMANT_YEARS } from '@/lib/payout/rules'

describe('shouldNotifyBalance', () => {
  const now = new Date('2026-06-30T00:00:00Z')

  test('閾値未満なら通知しない', () => {
    expect(shouldNotifyBalance(BALANCE_NOTIFY_THRESHOLD_YEN - 1, null, now)).toBe(false)
  })

  test('閾値以上かつ未通知なら通知する', () => {
    expect(shouldNotifyBalance(BALANCE_NOTIFY_THRESHOLD_YEN, null, now)).toBe(true)
  })

  test('30日以内に通知済みなら再通知しない', () => {
    const lastNotified = new Date('2026-06-15T00:00:00Z')
    expect(shouldNotifyBalance(BALANCE_NOTIFY_THRESHOLD_YEN, lastNotified, now)).toBe(false)
  })

  test('30日以上前に通知済みなら再通知する', () => {
    const lastNotified = new Date('2026-05-01T00:00:00Z')
    expect(shouldNotifyBalance(BALANCE_NOTIFY_THRESHOLD_YEN, lastNotified, now)).toBe(true)
  })
})

describe('isDormant', () => {
  const now = new Date('2026-06-30T00:00:00Z')

  test(`${DORMANT_YEARS}年未満なら休眠でない`, () => {
    const last = new Date('2025-01-01T00:00:00Z')
    expect(isDormant(last, now)).toBe(false)
  })

  test(`${DORMANT_YEARS}年以上経過していれば休眠`, () => {
    const last = new Date('2024-01-01T00:00:00Z')
    expect(isDormant(last, now)).toBe(true)
  })
})
