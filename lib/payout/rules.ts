// 出金処理の判定ロジック（純粋関数・テスト対象）

export const BALANCE_NOTIFY_THRESHOLD_YEN = 50000
export const DORMANT_YEARS = 2
const NOTIFY_INTERVAL_DAYS = 30 // 通知済みでも月1回までは再通知してよい

// 残高が閾値を超えており、かつ直近で通知していない場合に通知すべきと判定する
export function shouldNotifyBalance(
  balanceYen: number,
  lastNotifiedAt: Date | null,
  now: Date
): boolean {
  if (balanceYen < BALANCE_NOTIFY_THRESHOLD_YEN) return false
  if (!lastNotifiedAt) return true
  const daysSinceNotified = (now.getTime() - lastNotifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceNotified >= NOTIFY_INTERVAL_DAYS
}

// 直近の出金（payout_requests.processed_at）または最終活動から2年以上経過していれば休眠
export function isDormant(lastPayoutOrActivityAt: Date, now: Date): boolean {
  const yearsElapsed = (now.getTime() - lastPayoutOrActivityAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
  return yearsElapsed >= DORMANT_YEARS
}
