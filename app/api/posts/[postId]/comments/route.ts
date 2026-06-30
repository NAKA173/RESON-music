import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/sns/notify'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_LEN = 500

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comments')
    .select('id, body, user_id, created_at')
    .eq('post_id', postId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { body } = await req.json()
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: '本文は必須です' }, { status: 400 })
  }
  if (body.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `本文は${MAX_BODY_LEN}文字以内です` }, { status: 400 })
  }

  const { data: post } = await supabase.from('posts').select('author_user_id').eq('id', postId).single()
  if (!post) {
    return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: user.id, body: body.trim() })
    .select('id, body, user_id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await createNotification({
    userId: post.author_user_id,
    type: 'comment',
    actorUserId: user.id,
    targetType: 'post',
    targetId: postId,
  })

  return NextResponse.json({ comment })
}
