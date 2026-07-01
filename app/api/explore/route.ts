import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MIN_PLAYS = 100
const MAX_PLAYS = 5000
const LIMIT = 12

interface ExploreTrackRow {
  id: string
  title: string
  duration_sec: number
  cumulative_plays: number
  artists: { id: string; name: string } | { id: string; name: string }[] | null
  track_genres: { genres: { id: string; name: string } | { id: string; name: string }[] | null }[]
}

export async function GET() {
  const supabase = await createClient()

  // 知名度（再生数）ではなく相性で出会うため、再生数100〜5,000限定の楽曲のみを対象とする
  const { data: tracksData, error } = await supabase
    .from('tracks')
    .select(
      'id, title, duration_sec, cumulative_plays, artists ( id, name ), track_genres ( genres ( id, name ) )'
    )
    .gte('cumulative_plays', MIN_PLAYS)
    .lte('cumulative_plays', MAX_PLAYS)
    .eq('in_distribution', true)
    .eq('review_status', 'approved')
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let candidates = (tracksData ?? []) as ExploreTrackRow[]

  // ログインユーザーの再生履歴からジャンル親和度を算出し、相性の良い順に並べる
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: historyEvents } = await supabase
      .from('play_events')
      .select('track_id')
      .eq('user_id', user.id)

    const historyTrackIds = [...new Set((historyEvents ?? []).map((e) => e.track_id))]
    if (historyTrackIds.length > 0) {
      const { data: historyGenres } = await supabase
        .from('track_genres')
        .select('genre_id')
        .in('track_id', historyTrackIds)

      const likedGenreIds = new Set((historyGenres ?? []).map((g) => g.genre_id))

      if (likedGenreIds.size > 0) {
        candidates = [...candidates].sort((a, b) => {
          const aMatch = a.track_genres.some((tg) => {
            const g = tg.genres
            const id = Array.isArray(g) ? g[0]?.id : g?.id
            return id ? likedGenreIds.has(id) : false
          })
          const bMatch = b.track_genres.some((tg) => {
            const g = tg.genres
            const id = Array.isArray(g) ? g[0]?.id : g?.id
            return id ? likedGenreIds.has(id) : false
          })
          return Number(bMatch) - Number(aMatch)
        })
      }
    }
  }

  const result = candidates.slice(0, LIMIT).map((t) => {
    const artist = Array.isArray(t.artists) ? t.artists[0] : t.artists
    const genreNames = t.track_genres
      .map((tg) => (Array.isArray(tg.genres) ? tg.genres[0]?.name : tg.genres?.name))
      .filter((name): name is string => Boolean(name))

    return {
      id: t.id,
      title: t.title,
      duration_sec: t.duration_sec,
      cumulative_plays: t.cumulative_plays,
      artist: artist ?? null,
      genres: genreNames,
    }
  })

  return NextResponse.json({ tracks: result })
}
