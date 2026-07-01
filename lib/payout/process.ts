import type { SupabaseClient } from '@supabase/supabase-js'
import { shouldNotifyBalance, isDormant } from './rules'
import { createNotification } from '@/lib/sns/notify'

export type PayoutAction = 'paid' | 'rejected'

export async function processPayoutRequest(
  supabase: SupabaseClient,
  requestId: string,
  action: PayoutAction
) {
  const { data: request, error: fetchError } = await supabase
    .from('payout_requests')
    .select('id, artist_id, amount_yen, status')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    throw new Error('出金申請が見つかりません')
  }
  if (request.status !== 'pending') {
    throw new Error('この申請は既に処理済みです')
  }

  await supabase
    .from('payout_requests')
    .update({ status: action, processed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (action === 'paid') {
    // 出金額分を残高から減算（実際の銀行振込はこの後、運営担当者が bank_account の
    // 情報を参照して手動で行う。銀行API連携は未実装・最小実装）
    const { data: balance } = await supabase
      .from('artist_balances')
      .select('balance_yen')
      .eq('artist_id', request.artist_id)
      .single()

    const newBalance = (balance?.balance_yen ?? 0) - request.amount_yen
    await supabase
      .from('artist_balances')
      .update({ balance_yen: newBalance, updated_at: new Date().toISOString() })
      .eq('artist_id', request.artist_id)
  }

  const { data: bankAccount } = await supabase
    .from('artist_bank_accounts')
    .select('bank_name, branch_name, account_type, account_number, account_holder_name')
    .eq('artist_id', request.artist_id)
    .single()

  return {
    ok: true,
    request_id: requestId,
    action,
    amount_yen: request.amount_yen,
    bank_account: bankAccount ?? null,
  }
}

// 累積50,000円超え通知バッチ（毎月のCronから実行する前提）
export async function checkBalanceNotifications(supabase: SupabaseClient) {
  const { data: balances } = await supabase
    .from('artist_balances')
    .select('artist_id, balance_yen, last_notified_at')
    .eq('dormant', false)

  const now = new Date()
  let notified = 0

  for (const b of balances ?? []) {
    const lastNotifiedAt = b.last_notified_at ? new Date(b.last_notified_at) : null
    if (!shouldNotifyBalance(b.balance_yen, lastNotifiedAt, now)) continue

    const { data: artist } = await supabase
      .from('artists')
      .select('user_id')
      .eq('id', b.artist_id)
      .single()

    if (artist?.user_id) {
      await createNotification({
        userId: artist.user_id,
        type: 'balance_threshold',
        actorUserId: null,
      })
    }

    await supabase
      .from('artist_balances')
      .update({ last_notified_at: now.toISOString() })
      .eq('artist_id', b.artist_id)

    notified++
  }

  return { notified }
}

// 2年間未出金の休眠口座判定バッチ（没収はせず保留フラグのみ立てる）
export async function checkDormantAccounts(supabase: SupabaseClient) {
  const { data: balances } = await supabase
    .from('artist_balances')
    .select('artist_id, balance_yen, dormant, updated_at')
    .eq('dormant', false)
    .gt('balance_yen', 0)

  const now = new Date()
  let dormantCount = 0

  for (const b of balances ?? []) {
    const { data: lastPaid } = await supabase
      .from('payout_requests')
      .select('processed_at')
      .eq('artist_id', b.artist_id)
      .eq('status', 'paid')
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 出金履歴がなければ残高が初めて積まれた時点（updated_at）を基準にする
    const referenceDate = lastPaid?.processed_at ? new Date(lastPaid.processed_at) : new Date(b.updated_at)

    if (isDormant(referenceDate, now)) {
      await supabase
        .from('artist_balances')
        .update({ dormant: true })
        .eq('artist_id', b.artist_id)
      dormantCount++
    }
  }

  return { dormant: dormantCount }
}
