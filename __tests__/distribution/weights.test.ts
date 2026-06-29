import { calcWeight, calcSecFactor } from '@/lib/distribution/weights'

describe('calcWeight', () => {
  test('support_plus は 1.3', () => {
    expect(calcWeight('support_plus', false)).toBe(1.3)
  })
  test('standard は 1.0', () => {
    expect(calcWeight('standard', false)).toBe(1.0)
  })
  test('student は 0.7', () => {
    expect(calcWeight('student', false)).toBe(0.7)
  })
  test('free は 0.4', () => {
    expect(calcWeight('free', false)).toBe(0.4)
  })
  test('ai_generated は プランに関わらず 0.1', () => {
    expect(calcWeight('support_plus', true)).toBe(0.1)
    expect(calcWeight('standard', true)).toBe(0.1)
    expect(calcWeight('free', true)).toBe(0.1)
  })
})

describe('calcSecFactor', () => {
  test('30秒未満は 0', () => {
    expect(calcSecFactor(0, 300)).toBe(0)
    expect(calcSecFactor(29, 300)).toBe(0)
  })
  test('30秒以上かつ半分未満は 0.5', () => {
    expect(calcSecFactor(30, 300)).toBe(0.5)
    expect(calcSecFactor(149, 300)).toBe(0.5)
  })
  test('半分以上は 1.0', () => {
    expect(calcSecFactor(150, 300)).toBe(1.0)
    expect(calcSecFactor(300, 300)).toBe(1.0)
  })
  test('ちょうど半分（境界値）は 1.0', () => {
    expect(calcSecFactor(150, 300)).toBe(1.0)
  })
  test('短い楽曲（60秒）でも同じ判定', () => {
    expect(calcSecFactor(29, 60)).toBe(0)
    expect(calcSecFactor(30, 60)).toBe(1.0) // 30 >= 60 * 0.5
  })
})
