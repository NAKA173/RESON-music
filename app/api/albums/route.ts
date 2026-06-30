import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_TITLE_LEN = 200

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  let artistId = req.nextUrl.searchParams.get('artist_id')

  if (!artistId && req.nextUrl.searchParams.get('mine') === 'true') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const { data: artist } = await supabase
      .from('artists').select('id').eq('user_id', user.id).single()
    if (!artist) {
      return NextResponse.json({ albums: [] })
    }
    artistId = artist.id
  }

  let query = supabase
    .from('albums')
    .select('id, artist_id, title, cover_url, released_at, created_at, artists ( id, name )')
    .order('released_at', { ascending: false, nullsFirst: false })

  if (artistId) {
    query = query.eq('artist_id', artistId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ albums: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { title, cover_url, released_at } = await req.json()

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `タイトルは${MAX_TITLE_LEN}文字以内です` }, { status: 400 })
  }

  const { data: artist } = await supabase
    .from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      artist_id: artist.id,
      title: title.trim(),
      cover_url: cover_url || null,
      released_at: released_at || null,
    })
    .select('id, artist_id, title, cover_url, released_at, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ album })
}
