import { createClient } from '@/lib/supabase/server'
import { buildR2Key, getUploadUrl, getAudioExt } from '@/lib/audio'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { content_type, title, duration_sec, ai_generated, genre_ids } = await req.json()

  const ext = getAudioExt(content_type)
  if (!ext) {
    return NextResponse.json({ error: '対応していないファイル形式です（mp3/m4a/flac/wav/ogg）' }, { status: 400 })
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }
  if (!duration_sec || duration_sec < 1 || duration_sec > 7200) {
    return NextResponse.json({ error: '楽曲の長さが不正です' }, { status: 400 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  const trackId = randomUUID()
  const r2Key = buildR2Key(artist.id, trackId, ext)

  // tracks に pending レコードを作成（r2_key を確保）
  const { error: insertError } = await supabase.from('tracks').insert({
    id: trackId,
    artist_id: artist.id,
    title: title.trim(),
    duration_sec,
    r2_key: r2Key,
    ai_generated: ai_generated ?? false,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (Array.isArray(genre_ids) && genre_ids.length > 0) {
    await supabase
      .from('track_genres')
      .insert(genre_ids.slice(0, 3).map((genre_id: string) => ({ track_id: trackId, genre_id })))
  }

  const uploadUrl = await getUploadUrl(r2Key, content_type)

  return NextResponse.json({ track_id: trackId, upload_url: uploadUrl, r2_key: r2Key })
}
