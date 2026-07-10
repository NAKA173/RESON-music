import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  const supabase = await createClient()

  const { data: album } = await supabase
    .from('albums')
    .select('id, artist_id, title, cover_url, cover_r2_key, released_at, release_type, artists ( id, name )')
    .eq('id', albumId)
    .single()

  if (!album) {
    return NextResponse.json({ error: 'アルバムが見つかりません' }, { status: 404 })
  }

  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, duration_sec, track_number, cumulative_plays, ai_generated')
    .eq('album_id', albumId)
    .eq('review_status', 'approved')
    .order('track_number', { ascending: true, nullsFirst: false })

  const totalDurationSec = (tracks ?? []).reduce((sum, t) => sum + t.duration_sec, 0)

  return NextResponse.json({
    album,
    tracks: tracks ?? [],
    total_duration_sec: totalDurationSec,
  })
}
