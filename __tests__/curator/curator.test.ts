import { computeCuratorPoints, EARLY_SUPPORT_THRESHOLD } from '@/lib/curator'

describe('computeCuratorPoints', () => {
  test('0再生時点の応援は最大の加点になる', () => {
    expect(computeCuratorPoints(0)).toBe(10)
  })

  test('早いほど加点が大きい（単調減少）', () => {
    expect(computeCuratorPoints(10)).toBeGreaterThan(computeCuratorPoints(50))
    expect(computeCuratorPoints(50)).toBeGreaterThan(computeCuratorPoints(90))
  })

  test('閾値以上の再生数での応援は加点なし', () => {
    expect(computeCuratorPoints(EARLY_SUPPORT_THRESHOLD)).toBe(0)
    expect(computeCuratorPoints(EARLY_SUPPORT_THRESHOLD + 1)).toBe(0)
  })

  test('負の値は加点なし', () => {
    expect(computeCuratorPoints(-1)).toBe(0)
  })
})
