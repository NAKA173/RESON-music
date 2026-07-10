import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
  const from = new Date(year, 0, 1).toISOString()
  const to = new Date(year + 1, 0, 1).toISOString()

  const { data: events } = await supabase
    .from('play_events')
    .select('track_id, played_sec, completed')
    .eq('user_id', user.id)
    .gte('created_at', from)
    .lt('created_at', to)

  if (!events || events.length === 0) {
    return NextResponse.json({
      year,
      total_played_sec: 0,
      total_plays: 0,
      completed_plays: 0,
      distinct_tracks: 0,
      top_tracks: [],
      top_artists: [],
    })
  }

  const totalPlayedSec = events.reduce((sum, e) => sum + e.played_sec, 0)
  const completedPlays = events.filter((e) => e.completed).length

  const trackPlaySec = new Map<string, number>()
  const trackPlayCount = new Map<string, number>()
  for (const e of events) {
    trackPlaySec.set(e.track_id, (trackPlaySec.get(e.track_id) ?? 0) + e.played_sec)
    trackPlayCount.set(e.track_id, (trackPlayCount.get(e.track_id) ?? 0) + 1)
  }

  const trackIds = [...trackPlaySec.keys()]
  const { data: tracksData } = await supabase
    .from('tracks')
    .select('id, title, artist_id, artists ( id, name )')
    .in('id', trackIds)

  const trackMeta = new Map((tracksData ?? []).map((t) => [t.id, t]))

  const topTracks = [...trackPlaySec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([trackId, playedSec]) => {
      const meta = trackMeta.get(trackId)
      return {
        track_id: trackId,
        title: meta?.title ?? '不明な楽曲',
        artist_name: (meta?.artists as unknown as { name: string } | null)?.name ?? '不明',
        played_sec: playedSec,
        play_count: trackPlayCount.get(trackId) ?? 0,
      }
    })

  const artistPlaySec = new Map<string, number>()
  const artistName = new Map<string, string>()
  for (const [trackId, sec] of trackPlaySec) {
    const meta = trackMeta.get(trackId)
    if (!meta) continue
    artistPlaySec.set(meta.artist_id, (artistPlaySec.get(meta.artist_id) ?? 0) + sec)
    artistName.set(meta.artist_id, (meta.artists as unknown as { name: string } | null)?.name ?? '不明')
  }

  const topArtists = [...artistPlaySec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artistId, playedSec]) => ({
      artist_id: artistId,
      name: artistName.get(artistId) ?? '不明',
      played_sec: playedSec,
    }))

  return NextResponse.json({
    year,
    total_played_sec: totalPlayedSec,
    total_plays: events.length,
    completed_plays: completedPlays,
    distinct_tracks: trackIds.length,
    top_tracks: topTracks,
    top_artists: topArtists,
  })
}
