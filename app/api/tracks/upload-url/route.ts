import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildR2Key, getUploadUrl, getAudioExt } from '@/lib/audio'
import { normalizeIsrc, isValidIsrc } from '@/lib/isrc'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { content_type, content_length, title, duration_sec, ai_generated, genre_ids, album_id, track_number, isrc } = await req.json()

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
  if (!Number.isSafeInteger(content_length) || content_length < 1 || content_length > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'ファイルサイズは1〜200MBで指定してください' }, { status: 400 })
  }

  let normalizedIsrc: string | null = null
  if (isrc && typeof isrc === 'string' && isrc.trim()) {
    normalizedIsrc = normalizeIsrc(isrc)
    if (!isValidIsrc(normalizedIsrc)) {
      return NextResponse.json({ error: 'ISRCの形式が不正です（例: US-RC1-76-07839）' }, { status: 400 })
    }
    const { data: existingIsrc } = await supabase
      .from('tracks').select('id').eq('isrc', normalizedIsrc).maybeSingle()
    if (existingIsrc) {
      return NextResponse.json({ error: 'このISRCは既に別の楽曲で使用されています' }, { status: 409 })
    }
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  if (album_id) {
    const { data: album } = await supabase
      .from('albums').select('artist_id').eq('id', album_id).single()
    if (!album || album.artist_id !== artist.id) {
      return NextResponse.json({ error: 'このアルバムに楽曲を追加する権限がありません' }, { status: 403 })
    }
  }

  const trackId = randomUUID()
  const r2Key = buildR2Key(artist.id, trackId, ext)

  // tracks に pending レコードを作成（r2_key を確保）
  const service = createServiceClient()
  const { error: insertError } = await service.from('tracks').insert({
    id: trackId,
    artist_id: artist.id,
    title: title.trim(),
    duration_sec,
    r2_key: r2Key,
    ai_generated: ai_generated ?? false,
    album_id: album_id ?? null,
    track_number: album_id ? (track_number ?? null) : null,
    isrc: normalizedIsrc,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (Array.isArray(genre_ids) && genre_ids.length > 0) {
    await service
      .from('track_genres')
      .insert(genre_ids.slice(0, 3).map((genre_id: string) => ({ track_id: trackId, genre_id })))
  }

  const uploadUrl = await getUploadUrl(r2Key, content_type, content_length)

  return NextResponse.json({ track_id: trackId, upload_url: uploadUrl, r2_key: r2Key })
}
