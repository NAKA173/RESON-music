import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 保護者本人がログインした状態でリンクを開き、この API を叩いて承認/却下する。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { token, action } = await req.json()
  if (!token || (action !== 'approved' && action !== 'rejected')) {
    return NextResponse.json({ error: 'token と action("approved"|"rejected") は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: request } = await service
    .from('parental_link_requests')
    .select('id, child_user_id, status')
    .eq('token', token)
    .single()

  if (!request || request.status !== 'pending') {
    return NextResponse.json({ error: '有効な申請が見つかりません' }, { status: 400 })
  }
  if (request.child_user_id === user.id) {
    return NextResponse.json({ error: '自分自身を保護者に設定することはできません' }, { status: 400 })
  }

  await service
    .from('parental_link_requests')
    .update({ status: action, parent_user_id: user.id, resolved_at: new Date().toISOString() })
    .eq('id', request.id)

  if (action === 'approved') {
    await service
      .from('users')
      .update({ parent_user_id: user.id })
      .eq('id', request.child_user_id)
  }

  return NextResponse.json({ ok: true, action })
}
