import type { SupabaseClient } from '@supabase/supabase-js'

// 閾値は非公開（CLAUDE.md 不正検知セクション参照）。外部には種類のみ公開する。
const SAME_TRACK_WINDOW_MIN = 60
const SAME_TRACK_MAX_PLAYS = 5

const SAME_IP_MAX_PLAYS = 100

const HIGH_COMPLETION_THRESHOLD = 0.99
const HIGH_COMPLETION_STREAK = 30

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

export const FRAUD_THRESHOLDS = {
  SAME_TRACK_WINDOW_MIN,
  SAME_TRACK_MAX_PLAYS,
  SAME_IP_MAX_PLAYS,
  HIGH_COMPLETION_THRESHOLD,
  HIGH_COMPLETION_STREAK,
}
