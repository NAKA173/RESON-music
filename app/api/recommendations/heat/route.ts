import { createClient } from '@/lib/supabase/server'
import { calcTrackScores, rankTracksByHeat } from '@/lib/distribution'
import type { PlayEventRow } from '@/lib/distribution'
import { NextResponse } from 'next/server'

const WINDOW_DAYS = 14
const MIN_EVENTS = 3
const LIMIT = 10

export async function GET() {
  const supabase = await createClient()
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error: evErr } = await supabase
    .from('play_events')
    .select('track_id, weight, sec_factor, completed')
    .gte('created_at', since)

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 })
  }

  // 直近の再生が一定数あるトラックのみ対象（単発再生によるノイズを除外）
  const eventCounts = new Map<string, number>()
  for (const e of events ?? []) {
    eventCounts.set(e.track_id, (eventCounts.get(e.track_id) ?? 0) + 1)
  }
  const candidateTrackIds = [...eventCounts.entries()]
    .filter(([, count]) => count >= MIN_EVENTS)
    .map(([track_id]) => track_id)

  if (candidateTrackIds.length === 0) {
    return NextResponse.json({ tracks: [] })
  }

  const { data: tracksData, error: trErr } = await supabase
    .from('tracks')
    .select('id, title, duration_sec, ai_generated, cumulative_plays, artist_id, artists ( id, name )')
    .in('id', candidateTrackIds)

  if (trErr) {
    return NextResponse.json({ error: trErr.message }, { status: 500 })
  }

  const trackMeta = (tracksData ?? []).map((t) => ({ track_id: t.id, artist_id: t.artist_id }))
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
  const ranked = rankTracksByHeat(scores, LIMIT)

  const trackById = new Map((tracksData ?? []).map((t) => [t.id, t]))

  const result = ranked
    .map((s) => {
      const track = trackById.get(s.track_id)
      if (!track) return null
      return {
        id: track.id,
        title: track.title,
        duration_sec: track.duration_sec,
        ai_generated: track.ai_generated,
        cumulative_plays: track.cumulative_plays,
        artists: track.artists,
        completion_rate: s.completion_rate,
        support_rate: s.support_rate,
        heat_score: s.raw_score,
      }
    })
    .filter((t) => t !== null)

  return NextResponse.json({ tracks: result })
}
