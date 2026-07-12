// ISRC（国際標準レコーディングコード）: CC-XXX-YY-NNNNN 形式（12文字・ハイフン任意）
// CC=国コード（英字2）, XXX=登録者コード（英数字3）, YY=発行年（数字2）, NNNNN=固有番号（数字5）
const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/

/** 入力されたISRC文字列からハイフン・空白を除去し大文字化した正規形を返す */
export function normalizeIsrc(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

/** 正規形（12文字・ハイフンなし）のISRCが有効なフォーマットかどうかを判定する純粋関数 */
export function isValidIsrc(normalized: string): boolean {
  return ISRC_RE.test(normalized)
}

/** 表示用にハイフン区切り（CC-XXX-YY-NNNNN）へ整形する */
export function formatIsrc(normalized: string): string {
  if (!isValidIsrc(normalized)) return normalized
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5, 7)}-${normalized.slice(7, 12)}`
}
