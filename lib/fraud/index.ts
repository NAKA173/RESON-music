import type { SupabaseClient } from '@supabase/supabase-js'

// 閾値は非公開（CLAUDE.md 不正検知セクション参照）。外部には種類のみ公開する。
const SAME_TRACK_WINDOW_MIN = 60
const SAME_TRACK_MAX_PLAYS = 5

const SAME_IP_MAX_PLAYS = 100

const HIGH_COMPLETION_THRESHOLD = 0.99
const HIGH_COMPLETION_STREAK = 30

const MECHANICAL_INTERVAL_TOLERANCE_SEC = 1
const MECHANICAL_STREAK = 10
const SAME_IP_WINDOW_HOURS = 24

export type FlagType =
  | 'concentrated_plays'
  | 'same_ip'
  | 'mechanical_pattern'
  | 'abnormal_completion'

interface CheckPlayInput {
  trackId: string
  userId: string
  playedSec: number
  durationSec: number
  completed: boolean
}

async function raiseFlag(
  supabase: SupabaseClient,
  trackId: string,
  userId: string,
  flagType: FlagType,
  level: 1 | 2 | 3
) {
  // 同種・未解決のフラグが既にあれば再insertしない
  const { data: existing } = await supabase
    .from('fraud_flags')
    .select('id')
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .eq('flag_type', flagType)
    .eq('resolved', false)
    .maybeSingle()

  if (existing) return

  await supabase.from('fraud_flags').insert({
    track_id: trackId,
    user_id: userId,
    flag_type: flagType,
    level,
  })
}

/**
 * play_events INSERT直後に呼び、直近の再生パターンを簡易チェックする。
 * フラグが立った再生は分配計算側で除外する（fraud_flags.resolved=false を参照）。
 */
export async function checkPlayEvent(
  supabase: SupabaseClient,
  input: CheckPlayInput
): Promise<void> {
  const { trackId, userId, playedSec, durationSec, completed } = input

  // 1. 同一ユーザー×同一楽曲×1時間以内に5回以上
  const sameTrackSince = new Date(Date.now() - SAME_TRACK_WINDOW_MIN * 60 * 1000).toISOString()
  const { count: sameTrackCount } = await supabase
    .from('play_events')
    .select('id', { count: 'exact', head: true })
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .gte('created_at', sameTrackSince)

  if ((sameTrackCount ?? 0) + 1 >= SAME_TRACK_MAX_PLAYS) {
    await raiseFlag(supabase, trackId, userId, 'concentrated_plays', 1)
  }

  // 2. 完聴率99%以上の連続再生が30回以上
  if (durationSec > 0 && completed && playedSec / durationSec >= HIGH_COMPLETION_THRESHOLD) {
    const { count: highCompletionCount } = await supabase
      .from('play_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(HIGH_COMPLETION_STREAK)

    if ((highCompletionCount ?? 0) + 1 >= HIGH_COMPLETION_STREAK) {
      await raiseFlag(supabase, trackId, userId, 'abnormal_completion', 1)
    }
  }
}

/**
 * 同一IPからの大量再生を検知する（24時間以内に100再生以上）。
 * IPはplay_eventsに保存していないため、呼び出し側でカウントを別途集計して渡す。
 */
export async function checkSameIpVolume(
  supabase: SupabaseClient,
  trackId: string,
  userId: string,
  recentPlayCountFromIp: number
): Promise<void> {
  if (recentPlayCountFromIp >= SAME_IP_MAX_PLAYS) {
    await raiseFlag(supabase, trackId, userId, 'same_ip', 2)
  }
}

/**
 * 再生間隔が±1秒以内で連続するパターン（機械的な自動再生を疑う）を純粋関数として判定する。
 * timestampsMs は同一ユーザーの再生イベントの created_at（昇順）。
 */
export function detectMechanicalPattern(timestampsMs: number[]): boolean {
  if (timestampsMs.length < MECHANICAL_STREAK + 1) return false

  let streak = 1
  for (let i = 1; i < timestampsMs.length; i++) {
    const intervalSec = Math.abs(timestampsMs[i] - timestampsMs[i - 1]) / 1000
    const prevIntervalSec = i >= 2 ? Math.abs(timestampsMs[i - 1] - timestampsMs[i - 2]) / 1000 : intervalSec

    if (Math.abs(intervalSec - prevIntervalSec) <= MECHANICAL_INTERVAL_TOLERANCE_SEC) {
      streak++
      if (streak >= MECHANICAL_STREAK) return true
    } else {
      streak = 1
    }
  }
  return false
}

/**
 * 不正検知バッチ（種別2: 同一IP大量再生、種別4: 機械的パターン）。
 * 種別1・3は再生ログ受信時に即時チェック済み（checkPlayEvent）。このバッチは
 * IPベース・複数イベントに跨る集計が必要な種別を定期的に再走査する。
 */
export async function runFraudBatch(supabase: SupabaseClient): Promise<{ flagged: number }> {
  const since = new Date(Date.now() - SAME_IP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('play_events')
    .select('track_id, user_id, ip_address, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  let flagged = 0

  // 種別2: 同一IPから24時間以内に一定回数以上の再生（IP単位で集計し、関与した各 user×track に対してフラグ）
  const byIp = new Map<string, { track_id: string; user_id: string }[]>()
  for (const e of events ?? []) {
    if (!e.ip_address) continue
    const list = byIp.get(e.ip_address) ?? []
    list.push({ track_id: e.track_id, user_id: e.user_id })
    byIp.set(e.ip_address, list)
  }
  for (const [, plays] of byIp) {
    if (plays.length < SAME_IP_MAX_PLAYS) continue
    const uniquePairs = new Set(plays.map((p) => `${p.track_id}:${p.user_id}`))
    for (const pair of uniquePairs) {
      const [track_id, user_id] = pair.split(':')
      await raiseFlag(supabase, track_id, user_id, 'same_ip', 2)
      flagged++
    }
  }

  // 種別4: ユーザーごとに再生間隔の機械的パターンを検出
  const byUser = new Map<string, { track_id: string; ts: number }[]>()
  for (const e of events ?? []) {
    const list = byUser.get(e.user_id) ?? []
    list.push({ track_id: e.track_id, ts: new Date(e.created_at).getTime() })
    byUser.set(e.user_id, list)
  }
  for (const [user_id, plays] of byUser) {
    const timestamps = plays.map((p) => p.ts)
    if (detectMechanicalPattern(timestamps)) {
      const lastTrackId = plays[plays.length - 1].track_id
      await raiseFlag(supabase, lastTrackId, user_id, 'mechanical_pattern', 2)
      flagged++
    }
  }

  return { flagged }
}

export const FRAUD_THRESHOLDS = {
  SAME_TRACK_WINDOW_MIN,
  SAME_TRACK_MAX_PLAYS,
  SAME_IP_MAX_PLAYS,
  HIGH_COMPLETION_THRESHOLD,
  HIGH_COMPLETION_STREAK,
  MECHANICAL_INTERVAL_TOLERANCE_SEC,
  MECHANICAL_STREAK,
  SAME_IP_WINDOW_HOURS,
}
