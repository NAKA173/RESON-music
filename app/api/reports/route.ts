import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_TARGET_TYPES = ['post', 'comment', 'user', 'artist']
const MAX_REASON_LEN = 500

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { target_type, target_id, reason } = await req.json()

  if (!ALLOWED_TARGET_TYPES.includes(target_type)) {
    return NextResponse.json({ error: 'target_type が不正です' }, { status: 400 })
  }
  if (!target_id) {
    return NextResponse.json({ error: 'target_id は必須です' }, { status: 400 })
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: '理由は必須です' }, { status: 400 })
  }
  if (reason.length > MAX_REASON_LEN) {
    return NextResponse.json({ error: `理由は${MAX_REASON_LEN}文字以内です` }, { status: 400 })
  }

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      target_type,
      target_id,
      reason: reason.trim(),
    })
    .select('id, target_type, target_id, reason, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ report })
}
