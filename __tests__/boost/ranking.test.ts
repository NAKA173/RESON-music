import { computeGrowthRate } from '@/lib/boost/ranking'

describe('computeGrowthRate', () => {
  test('今週ゼロなら伸び率もゼロ', () => {
    expect(computeGrowthRate(0, 10)).toBe(0)
  })

  test('前週ゼロでも今週の伸びを正しく評価する（ゼロ除算しない）', () => {
    expect(computeGrowthRate(5, 0)).toBe(5)
  })

  test('前週比で伸びているほど高いスコアになる', () => {
    expect(computeGrowthRate(20, 5)).toBeGreaterThan(computeGrowthRate(10, 5))
  })

  test('前週と同水準なら1に近い値になる', () => {
    expect(computeGrowthRate(10, 10)).toBeCloseTo(10 / 11, 5)
  })
})
