import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/sns/notify'
import { NextRequest, NextResponse } from 'next/server'

const TARGET_TYPES = ['post', 'track', 'comment', 'artist']

async function getOwnerUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetType: string,
  targetId: string
): Promise<string | null> {
  if (targetType === 'post') {
    const { data } = await supabase.from('posts').select('author_user_id').eq('id', targetId).single()
    return data?.author_user_id ?? null
  }
  if (targetType === 'artist') {
    const { data } = await supabase.from('artists').select('user_id').eq('id', targetId).single()
    return data?.user_id ?? null
  }
  if (targetType === 'track') {
    const { data } = await supabase.from('tracks').select('artist_id, artists(user_id)').eq('id', targetId).single()
    return (data?.artists as { user_id?: string } | null)?.user_id ?? null
  }
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { target_type, target_id } = await req.json()
  if (!TARGET_TYPES.includes(target_type) || !target_id) {
    return NextResponse.json({ error: 'target_type / target_id が不正です' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .maybeSingle()

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id)
    return NextResponse.json({ ok: true, liked: false })
  }

  const { error } = await supabase.from('likes').insert({
    user_id: user.id,
    target_type,
    target_id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ownerId = await getOwnerUserId(supabase, target_type, target_id)
  if (ownerId) {
    await createNotification({
      userId: ownerId,
      type: 'like',
      actorUserId: user.id,
      targetType: target_type,
      targetId: target_id,
    })
  }

  return NextResponse.json({ ok: true, liked: true })
}
