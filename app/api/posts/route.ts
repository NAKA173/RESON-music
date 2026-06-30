import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_LEN = 1000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 50)
  const genreId = req.nextUrl.searchParams.get('genre_id')

  let query = supabase
    .from('posts')
    .select(`
      id, body, visibility, created_at, track_id, genre_id,
      author_user_id, author_artist_id,
      tracks ( id, title ),
      artists:author_artist_id ( id, name )
    `)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (genreId) {
    query = query.eq('genre_id', genreId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ブロック関係にある相手の投稿は除外する（ログイン中のみ）
  const { data: { user } } = await supabase.auth.getUser()
  let posts = data ?? []
  if (user) {
    const { data: blocked } = await supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
    const hiddenAuthors = new Set(
      (blocked ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id))
    )
    posts = posts.filter((p) => !hiddenAuthors.has(p.author_user_id))
  }

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { body, track_id, author_artist_id, visibility, genre_id } = await req.json()

  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: '本文は必須です' }, { status: 400 })
  }
  if (body.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `本文は${MAX_BODY_LEN}文字以内です` }, { status: 400 })
  }

  if (author_artist_id) {
    const { data: artist } = await supabase
      .from('artists').select('user_id').eq('id', author_artist_id).single()
    if (!artist || artist.user_id !== user.id) {
      return NextResponse.json({ error: 'このアーティストとして投稿する権限がありません' }, { status: 403 })
    }
  }

  const allowedVisibility = ['public', 'followers', 'private', 'supporter_only']
  const vis = allowedVisibility.includes(visibility) ? visibility : 'public'

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_user_id: user.id,
      author_artist_id: author_artist_id ?? null,
      track_id: track_id ?? null,
      body: body.trim(),
      visibility: vis,
      genre_id: genre_id ?? null,
    })
    .select('id, body, visibility, created_at, track_id, genre_id, author_user_id, author_artist_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ post })
}
