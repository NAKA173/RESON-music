import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_LEN = 1000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 50)

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, body, visibility, created_at, track_id,
      author_user_id, author_artist_id,
      tracks ( id, title ),
      artists:author_artist_id ( id, name )
    `)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { body, track_id, author_artist_id, visibility } = await req.json()

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
    })
    .select('id, body, visibility, created_at, track_id, author_user_id, author_artist_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ post })
}
