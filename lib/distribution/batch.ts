import type { SupabaseClient } from '@supabase/supabase-js'
import { calcTrackScores, calcDistribution } from './score'
import { createNotification } from '@/lib/sns/notify'
import type { PlayEventRow } from './types'

export async function runMonthlyDistribution(
  supabase: SupabaseClient,
  yearMonth: string // "2026-07"
) {
  const [year, month] = yearMonth.split('-').map(Number)
  const from = new Date(year, month - 1, 1).toISOString()
  const to = new Date(year, month, 1).toISOString()

  // 分配対象楽曲（cumulative_plays >= 100）の play_events を取得
  const { data: events, error: evErr } = await supabase
    .from('play_events')
    .select('track_id, user_id, weight, sec_factor, completed')
    .gte('created_at', from)
    .lt('created_at', to)

  if (evErr) throw new Error(`play_events fetch failed: ${evErr.message}`)

  // 不正検知フラグ（未解決）が立っている track_id × user_id の組は分配計算から除外する
  const { data: flags } = await supabase
    .from('fraud_flags')
    .select('track_id, user_id')
    .eq('resolved', false)

  const flaggedPairs = new Set((flags ?? []).map((f: { track_id: string; user_id: string }) => `${f.track_id}:${f.user_id}`))

  const cleanEvents = (events ?? []).filter(
    (e: { track_id: string; user_id: string }) => !flaggedPairs.has(`${e.track_id}:${e.user_id}`)
  )

  // 対象 track_id を in_distribution = true のもので絞り込む
  const trackIds = [...new Set(cleanEvents.map((e: { track_id: string }) => e.track_id))]
  if (trackIds.length === 0) return { distributed: 0 }

  const { data: tracksData } = await supabase
    .from('tracks')
    .select('id, artist_id, in_distribution')
    .in('id', trackIds)
    .eq('in_distribution', true)

  const eligibleTrackIds = new Set((tracksData ?? []).map((t: { id: string }) => t.id))
  const trackMeta = (tracksData ?? []).map((t: { id: string; artist_id: string }) => ({
    track_id: t.id,
    artist_id: t.artist_id,
  }))

  const eligibleEvents: PlayEventRow[] = cleanEvents.filter(
    (e: { track_id: string }) => eligibleTrackIds.has(e.track_id)
  )

  // 応援数を集計
  const { data: supportsData } = await supabase
    .from('supports')
    .select('track_id')
    .in('track_id', [...eligibleTrackIds])
    .gte('created_at', from)
    .lt('created_at', to)

  const supportCounts = new Map<string, number>()
  for (const s of supportsData ?? []) {
    supportCounts.set(s.track_id, (supportCounts.get(s.track_id) ?? 0) + 1)
  }
  const supports = [...supportCounts.entries()].map(([track_id, count]) => ({ track_id, count }))

  // ブーストハート数を集計（応援度スコアへ重み2倍で反映）
  const { data: boostsData } = await supabase
    .from('boost_hearts')
    .select('track_id')
    .in('track_id', [...eligibleTrackIds])
    .gte('created_at', from)
    .lt('created_at', to)

  const boostCounts = new Map<string, number>()
  for (const b of boostsData ?? []) {
    boostCounts.set(b.track_id, (boostCounts.get(b.track_id) ?? 0) + 1)
  }
  const boosts = [...boostCounts.entries()].map(([track_id, count]) => ({ track_id, count }))

  // 熱量スコア計算
  const scores = calcTrackScores(eligibleEvents, supports, trackMeta, boosts)
  if (scores.length === 0) return { distributed: 0 }

  // 月次プール計算（ユーザー数 × プラン別寄与額）
  const { data: planCounts } = await supabase
    .from('users')
    .select('plan')

  const pool = calcTotalPool(planCounts ?? [])

  // 分配計算
  const distributions = calcDistribution(scores, pool)

  // monthly_distributions と artist_balances を更新
  for (const [artist_id, distribution_yen] of distributions) {
    const artistScore = scores.find((s) => s.artist_id === artist_id)!

    // 月次レコードを upsert（冪等）
    await supabase.from('monthly_distributions').upsert(
      {
        artist_id,
        year_month: yearMonth,
        total_pool_yen: pool,
        artist_share_ratio: distribution_yen / pool,
        distribution_yen,
        score_breakdown: {
          play_time_score: artistScore.play_time_score,
          support_rate: artistScore.support_rate,
          completion_rate: artistScore.completion_rate,
        },
      },
      { onConflict: 'artist_id,year_month' }
    )

    // 残高加算
    await supabase.rpc('add_artist_balance', {
      p_artist_id: artist_id,
      p_amount: distribution_yen,
    })

    // 月次レポート確定通知
    if (distribution_yen > 0) {
      const { data: artist } = await supabase.from('artists').select('user_id').eq('id', artist_id).single()
      if (artist?.user_id) {
        await createNotification({
          userId: artist.user_id,
          type: 'monthly_report',
          actorUserId: null,
          targetType: 'monthly_distribution',
          targetId: artist_id,
        })
      }
    }
  }

  return { distributed: distributions.size, pool }
}

function calcTotalPool(users: { plan: string }[]): number {
  const rates: Record<string, number> = {
    standard: 750 * 0.75,
    student: 250 * 0.8,
    support_plus: 1000 * 0.8,
    free: 60 * 0.7,
  }
  return users.reduce((sum, u) => sum + (rates[u.plan] ?? 0), 0)
}
