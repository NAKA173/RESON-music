import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: genres, error } = await supabase
    .from('genres')
    .select('id, name, parent_id')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: members } = await supabase
    .from('community_members')
    .select('genre_id')

  const memberCounts = new Map<string, number>()
  for (const m of members ?? []) {
    memberCounts.set(m.genre_id, (memberCounts.get(m.genre_id) ?? 0) + 1)
  }

  let joinedGenreIds = new Set<string>()
  if (user) {
    const { data: mine } = await supabase
      .from('community_members')
      .select('genre_id')
      .eq('user_id', user.id)
    joinedGenreIds = new Set((mine ?? []).map((m) => m.genre_id))
  }

  const communities = (genres ?? []).map((g) => ({
    ...g,
    member_count: memberCounts.get(g.id) ?? 0,
    joined: joinedGenreIds.has(g.id),
  }))

  return NextResponse.json({ communities })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { genre_id } = await req.json()
  if (!genre_id) {
    return NextResponse.json({ error: 'genre_id は必須です' }, { status: 400 })
  }

  const { error } = await supabase.from('community_members').insert({
    user_id: user.id,
    genre_id,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { genre_id } = await req.json()
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('user_id', user.id)
    .eq('genre_id', genre_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
