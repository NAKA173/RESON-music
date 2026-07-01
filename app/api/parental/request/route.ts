import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// ペアレンタル決済のための紐付けリクエストを作成する。
// メール配信基盤が未構築のため、生成したリンクは本人が保護者へ直接共有する運用とする。
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('parental_link_requests')
    .select('id, token')
    .eq('child_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ token: existing.token })
  }

  const token = randomBytes(16).toString('hex')

  const { error } = await supabase.from('parental_link_requests').insert({
    child_user_id: user.id,
    token,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token })
}
