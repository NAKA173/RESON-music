import { createClient } from '@/lib/supabase/server'
import { rankTracksByHeat } from '@/lib/distribution'
import { fetchHeatScoredCandidates } from '@/lib/distribution/heat-candidates'
import { NextResponse } from 'next/server'

const LIMIT = 10

export async function GET() {
  const supabase = await createClient()
  const { scores, trackById } = await fetchHeatScoredCandidates(supabase)
  const ranked = rankTracksByHeat(scores, LIMIT)

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
