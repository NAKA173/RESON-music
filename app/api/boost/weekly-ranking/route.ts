import { createClient } from '@/lib/supabase/server'
import { computeGrowthRate } from '@/lib/boost/ranking'
import { NextResponse } from 'next/server'

const MIN_CUMULATIVE_PLAYS = 500
const LIMIT = 20

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const thisWeekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const lastWeekStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: boosts } = await supabase
    .from('boost_hearts')
    .select('track_id, created_at')
    .gte('created_at', lastWeekStart)

  if (!boosts || boosts.length === 0) {
    return NextResponse.json({ tracks: [] })
  }

  const thisWeekCount = new Map<string, number>()
  const lastWeekCount = new Map<string, number>()
  for (const b of boosts) {
    const bucket = b.created_at >= thisWeekStart ? thisWeekCount : lastWeekCount
    bucket.set(b.track_id, (bucket.get(b.track_id) ?? 0) + 1)
  }

  const candidateTrackIds = [...thisWeekCount.keys()]
  if (candidateTrackIds.length === 0) {
    return NextResponse.json({ tracks: [] })
  }

  const { data: tracksData } = await supabase
    .from('tracks')
    .select('id, title, cumulative_plays, artists ( id, name )')
    .in('id', candidateTrackIds)
    .gte('cumulative_plays', MIN_CUMULATIVE_PLAYS)
    .eq('review_status', 'approved')

  const ranked = (tracksData ?? [])
    .map((t) => {
      const thisWeek = thisWeekCount.get(t.id) ?? 0
      const lastWeek = lastWeekCount.get(t.id) ?? 0
      return {
        id: t.id,
        title: t.title,
        cumulative_plays: t.cumulative_plays,
        artists: t.artists,
        this_week_boosts: thisWeek,
        last_week_boosts: lastWeek,
        growth_rate: computeGrowthRate(thisWeek, lastWeek),
      }
    })
    .filter((t) => t.this_week_boosts > 0)
    .sort((a, b) => b.growth_rate - a.growth_rate)
    .slice(0, LIMIT)

  return NextResponse.json({ tracks: ranked })
}
