import { createClient } from '@/lib/supabase/server'
import { normalizeIsrc, isValidIsrc } from '@/lib/isrc'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await req.json()

  const { data: track } = await supabase
    .from('tracks')
    .select('id, artist_id, artists ( user_id )')
    .eq('id', trackId)
    .single()

  if (!track || (track.artists as unknown as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: 'この楽曲を編集する権限がありません' }, { status: 403 })
  }

  const update: Record<string, unknown> = {}

  if ('album_id' in body) {
    const { album_id, track_number } = body
    if (album_id) {
      const { data: album } = await supabase
        .from('albums').select('artist_id').eq('id', album_id).single()
      if (!album || album.artist_id !== track.artist_id) {
        return NextResponse.json({ error: 'このアルバムに楽曲を追加する権限がありません' }, { status: 403 })
      }
    }
    update.album_id = album_id ?? null
    update.track_number = album_id ? (track_number ?? null) : null
  }

  if ('lyrics' in body) {
    if (typeof body.lyrics === 'string' && body.lyrics.length > 10000) {
      return NextResponse.json({ error: '歌詞は10000文字以内です' }, { status: 400 })
    }
    update.lyrics = typeof body.lyrics === 'string' ? body.lyrics : null
  }

  if ('isrc' in body) {
    if (typeof body.isrc === 'string' && body.isrc.trim()) {
      const normalized = normalizeIsrc(body.isrc)
      if (!isValidIsrc(normalized)) {
        return NextResponse.json({ error: 'ISRCの形式が不正です（例: US-RC1-76-07839）' }, { status: 400 })
      }
      const { data: existingIsrc } = await supabase
        .from('tracks').select('id').eq('isrc', normalized).neq('id', trackId).maybeSingle()
      if (existingIsrc) {
        return NextResponse.json({ error: 'このISRCは既に別の楽曲で使用されています' }, { status: 409 })
      }
      update.isrc = normalized
    } else {
      update.isrc = null
    }
  }

  const { data: updated, error } = await supabase
    .from('tracks')
    .update(update)
    .eq('id', trackId)
    .select('id, title, album_id, track_number, lyrics, isrc')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ track: updated })
}
