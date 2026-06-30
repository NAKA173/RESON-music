import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { album_id } = await req.json()

  const { data: track } = await supabase
    .from('tracks')
    .select('id, artist_id, artists ( user_id )')
    .eq('id', trackId)
    .single()

  if (!track || (track.artists as unknown as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: 'この楽曲を編集する権限がありません' }, { status: 403 })
  }

  if (album_id) {
    const { data: album } = await supabase
      .from('albums').select('artist_id').eq('id', album_id).single()
    if (!album || album.artist_id !== track.artist_id) {
      return NextResponse.json({ error: 'このアルバムに楽曲を追加する権限がありません' }, { status: 403 })
    }
  }

  const { data: updated, error } = await supabase
    .from('tracks')
    .update({ album_id: album_id ?? null })
    .eq('id', trackId)
    .select('id, title, album_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ track: updated })
}
