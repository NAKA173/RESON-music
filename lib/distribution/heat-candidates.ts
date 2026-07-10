import type { SupabaseClient } from '@supabase/supabase-js'
import { calcTrackScores } from './score'
import type { PlayEventRow, TrackScore } from './types'

export const HEAT_WINDOW_DAYS = 14
const MIN_EVENTS = 3

export interface TrackMetaRow {
  id: string
  title: string
  duration_sec: number
  ai_generated: boolean
  cumulative_plays: number
  artist_id: string
  artists: { id: string; name: string }[] | { id: string; name: string } | null
}

/**
 * 直近 HEAT_WINDOW_DAYS 日間の再生から、ノイズ（単発再生）を除いた
 * トラックごとの熱量スコアとメタデータを返す。複数のレコメンドAPIで共有する。
 */
export async function fetchHeatScoredCandidates(
  supabase: SupabaseClient
): Promise<{ scores: TrackScore[]; trackById: Map<string, TrackMetaRow> }> {
  const since = new Date(Date.now() - HEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('play_events')
    .select('track_id, weight, sec_factor, completed')
    .gte('created_at', since)

  const eventCounts = new Map<string, number>()
  for (const e of events ?? []) {
    eventCounts.set(e.track_id, (eventCounts.get(e.track_id) ?? 0) + 1)
  }
  const candidateTrackIds = [...eventCounts.entries()]
    .filter(([, count]) => count >= MIN_EVENTS)
    .map(([track_id]) => track_id)

  if (candidateTrackIds.length === 0) {
    return { scores: [], trackById: new Map() }
  }

  const { data: tracksData } = await supabase
    .from('tracks')
    .select('id, title, duration_sec, ai_generated, cumulative_plays, artist_id, artists ( id, name )')
    .in('id', candidateTrackIds)
    .eq('review_status', 'approved')
    .eq('fraud_suspended', false)

  const trackMeta = (tracksData ?? []).map((t: TrackMetaRow) => ({
    track_id: t.id,
    artist_id: t.artist_id,
  }))
  const candidateEvents: PlayEventRow[] = (events ?? []).filter((e) =>
    candidateTrackIds.includes(e.track_id)
  )

  const { data: supportsData } = await supabase
    .from('supports')
    .select('track_id')
    .in('track_id', candidateTrackIds)
    .gte('created_at', since)

  const supportCounts = new Map<string, number>()
  for (const s of supportsData ?? []) {
    supportCounts.set(s.track_id, (supportCounts.get(s.track_id) ?? 0) + 1)
  }
  const supports = [...supportCounts.entries()].map(([track_id, count]) => ({ track_id, count }))

  const scores = calcTrackScores(candidateEvents, supports, trackMeta)
  const trackById = new Map<string, TrackMetaRow>((tracksData ?? []).map((t: TrackMetaRow) => [t.id, t]))

  return { scores, trackById }
}
