import { normalizeIsrc, isValidIsrc, formatIsrc } from '@/lib/isrc'

describe('normalizeIsrc', () => {
  test('ハイフン・空白を除去し大文字化する', () => {
    expect(normalizeIsrc('us-rc1-76-07839')).toBe('USRC17607839')
    expect(normalizeIsrc('US RC1 76 07839')).toBe('USRC17607839')
    expect(normalizeIsrc('USRC17607839')).toBe('USRC17607839')
  })
})

describe('isValidIsrc', () => {
  test('正しい形式は有効', () => {
    expect(isValidIsrc('USRC17607839')).toBe(true)
    expect(isValidIsrc('JPA001234567')).toBe(true)
  })

  test('長さが違う場合は無効', () => {
    expect(isValidIsrc('USRC1760783')).toBe(false)
    expect(isValidIsrc('USRC176078399')).toBe(false)
  })

  test('国コード部分が数字だと無効', () => {
    expect(isValidIsrc('12RC17607839')).toBe(false)
  })

  test('発行年・固有番号部分が数字でないと無効', () => {
    expect(isValidIsrc('USRCXX607839')).toBe(false)
    expect(isValidIsrc('USRC17ABCDE9')).toBe(false)
  })
})

describe('formatIsrc', () => {
  test('ハイフン区切りに整形する', () => {
    expect(formatIsrc('USRC17607839')).toBe('US-RC1-76-07839')
  })

  test('不正な形式はそのまま返す', () => {
    expect(formatIsrc('INVALID')).toBe('INVALID')
  })
})
