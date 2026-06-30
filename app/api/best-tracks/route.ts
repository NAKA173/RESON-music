import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_RANK = 10

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const userId = req.nextUrl.searchParams.get('user_id')

  let targetId = userId
  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    targetId = user.id
  }

  const { data, error } = await supabase
    .from('best_tracks')
    .select('rank, track_id, tracks ( id, title, album_id, artists ( id, name ), albums ( id, title, cover_url ) )')
    .eq('user_id', targetId)
    .order('rank', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ best_tracks: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { track_ids } = await req.json()
  if (!Array.isArray(track_ids) || track_ids.length === 0) {
    return NextResponse.json({ error: 'track_ids は必須です' }, { status: 400 })
  }
  if (track_ids.length > MAX_RANK) {
    return NextResponse.json({ error: `ランキングは${MAX_RANK}件までです` }, { status: 400 })
  }
  if (new Set(track_ids).size !== track_ids.length) {
    return NextResponse.json({ error: '同じ楽曲を複数回ランクインできません' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('best_tracks')
    .delete()
    .eq('user_id', user.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const rows = track_ids.map((track_id: string, i: number) => ({
    user_id: user.id,
    rank: i + 1,
    track_id,
  }))

  const { data, error } = await supabase
    .from('best_tracks')
    .insert(rows)
    .select('rank, track_id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ best_tracks: data })
}
