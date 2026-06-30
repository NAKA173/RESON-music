import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_TITLE_LEN = 200
const MAX_DESC_LEN = 2000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const artistId = req.nextUrl.searchParams.get('artist_id')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 50)

  let query = supabase
    .from('events')
    .select('id, artist_id, title, description, event_at, location, ticket_url, created_at, artists ( id, name )')
    .gte('event_at', new Date().toISOString())
    .order('event_at', { ascending: true })
    .limit(limit)

  if (artistId) {
    query = query.eq('artist_id', artistId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { artist_id, title, description, event_at, location, ticket_url } = await req.json()

  if (!artist_id) {
    return NextResponse.json({ error: 'artist_id は必須です' }, { status: 400 })
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `タイトルは${MAX_TITLE_LEN}文字以内です` }, { status: 400 })
  }
  if (description && description.length > MAX_DESC_LEN) {
    return NextResponse.json({ error: `説明は${MAX_DESC_LEN}文字以内です` }, { status: 400 })
  }
  if (!event_at) {
    return NextResponse.json({ error: 'event_at は必須です' }, { status: 400 })
  }

  const { data: artist } = await supabase
    .from('artists').select('user_id').eq('id', artist_id).single()
  if (!artist || artist.user_id !== user.id) {
    return NextResponse.json({ error: 'このアーティストとしてイベントを作成する権限がありません' }, { status: 403 })
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      artist_id,
      title: title.trim(),
      description: description?.trim() || null,
      event_at,
      location: location || null,
      ticket_url: ticket_url || null,
    })
    .select('id, artist_id, title, description, event_at, location, ticket_url, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ event })
}
