import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/sns/notify'
import { isBlockedEitherWay } from '@/lib/sns/blocks'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const withUserId = req.nextUrl.searchParams.get('with')
  if (!withUserId) {
    return NextResponse.json({ error: 'with は必須です' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, body, track_id, read_at, created_at, tracks ( id, title, artists ( id, name ) )')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${withUserId}),and(sender_id.eq.${withUserId},recipient_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 未読（自分が受信者）のものを既読にする
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('sender_id', withUserId)
    .is('read_at', null)

  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { recipient_id, body, track_id } = await req.json()
  const trimmedBody = typeof body === 'string' ? body.trim() : ''
  if (!recipient_id || (!trimmedBody && !track_id)) {
    return NextResponse.json({ error: 'recipient_id と本文または楽曲の添付が必要です' }, { status: 400 })
  }
  if (trimmedBody.length > 1000) {
    return NextResponse.json({ error: 'メッセージは1000文字以内です' }, { status: 400 })
  }
  if (recipient_id === user.id) {
    return NextResponse.json({ error: '自分自身にはメッセージを送れません' }, { status: 400 })
  }

  if (await isBlockedEitherWay(supabase, user.id, recipient_id)) {
    return NextResponse.json({ error: 'メッセージを送信できません' }, { status: 403 })
  }

  const { data: message, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: user.id, recipient_id, body: trimmedBody, track_id: track_id ?? null })
    .select('id, sender_id, recipient_id, body, track_id, read_at, created_at, tracks ( id, title, artists ( id, name ) )')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await createNotification({
    userId: recipient_id,
    type: 'message',
    actorUserId: user.id,
    targetType: 'direct_message',
    targetId: message.id,
  })

  return NextResponse.json({ message })
}
