import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_TITLE_LEN = 100

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const userId = req.nextUrl.searchParams.get('user_id')

  let targetId = userId
  if (!targetId && req.nextUrl.searchParams.get('mine') === 'true') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    targetId = user.id
  }

  let query = supabase
    .from('playlists')
    .select('id, user_id, title, is_public, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (targetId) {
    query = query.eq('user_id', targetId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ playlists: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { title, is_public } = await req.json()

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `タイトルは${MAX_TITLE_LEN}文字以内です` }, { status: 400 })
  }

  const { data: playlist, error } = await supabase
    .from('playlists')
    .insert({ user_id: user.id, title: title.trim(), is_public: is_public ?? true })
    .select('id, user_id, title, is_public, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ playlist })
}
