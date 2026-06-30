import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/sns/notify'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'following'

  const { data, error } = mode === 'followers'
    ? await supabase.from('follows').select('id, follower_id, followee_type, created_at')
        .eq('followee_type', 'user').eq('followee_id', user.id)
    : await supabase.from('follows').select('id, followee_type, followee_id, created_at')
        .eq('follower_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ follows: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { followee_type, followee_id } = await req.json()
  if (followee_type !== 'user' && followee_type !== 'artist') {
    return NextResponse.json({ error: 'followee_type は user または artist です' }, { status: 400 })
  }
  if (!followee_id) {
    return NextResponse.json({ error: 'followee_id は必須です' }, { status: 400 })
  }
  if (followee_type === 'user' && followee_id === user.id) {
    return NextResponse.json({ error: '自分自身をフォローできません' }, { status: 400 })
  }

  const { error } = await supabase.from('follows').insert({
    follower_id: user.id,
    followee_type,
    followee_id,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (followee_type === 'user') {
    await createNotification({ userId: followee_id, type: 'follow', actorUserId: user.id })
  } else {
    const { data: artist } = await supabase.from('artists').select('user_id').eq('id', followee_id).single()
    if (artist) {
      await createNotification({ userId: artist.user_id, type: 'follow', actorUserId: user.id, targetType: 'artist', targetId: followee_id })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { followee_type, followee_id } = await req.json()
  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', user.id)
    .eq('followee_type', followee_type)
    .eq('followee_id', followee_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
