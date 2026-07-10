import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function assertOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playlistId: string,
  userId: string
) {
  const { data } = await supabase.from('playlists').select('user_id').eq('id', playlistId).single()
  return data?.user_id === userId
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  if (!(await assertOwner(supabase, playlistId, user.id))) {
    return NextResponse.json({ error: '編集する権限がありません' }, { status: 403 })
  }

  const { track_id } = await req.json()
  if (!track_id) {
    return NextResponse.json({ error: 'track_id は必須です' }, { status: 400 })
  }

  const { count } = await supabase
    .from('playlist_tracks')
    .select('id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId)

  const { error } = await supabase.from('playlist_tracks').insert({
    playlist_id: playlistId,
    track_id,
    position: count ?? 0,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'すでにこのプレイリストに追加されています' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)

  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  if (!(await assertOwner(supabase, playlistId, user.id))) {
    return NextResponse.json({ error: '編集する権限がありません' }, { status: 403 })
  }

  const { track_ids } = await req.json()
  if (!Array.isArray(track_ids)) {
    return NextResponse.json({ error: 'track_ids は必須です' }, { status: 400 })
  }

  await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId)

  if (track_ids.length > 0) {
    const rows = track_ids.map((track_id: string, i: number) => ({
      playlist_id: playlistId,
      track_id,
      position: i,
    }))
    const { error } = await supabase.from('playlist_tracks').insert(rows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  if (!(await assertOwner(supabase, playlistId, user.id))) {
    return NextResponse.json({ error: '編集する権限がありません' }, { status: 403 })
  }

  const { track_id } = await req.json()
  if (!track_id) {
    return NextResponse.json({ error: 'track_id は必須です' }, { status: 400 })
  }

  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('track_id', track_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
