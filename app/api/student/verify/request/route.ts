import { createClient } from '@/lib/supabase/server'
import { isEdJpEmail, generateVerificationCode, codeExpiresAt } from '@/lib/student/verify'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { school_email } = await req.json()
  if (!school_email || !isEdJpEmail(school_email)) {
    return NextResponse.json({ error: '学校発行の .ed.jp メールアドレスを入力してください' }, { status: 400 })
  }

  const now = new Date()
  const code = generateVerificationCode()

  const { error } = await supabase.from('student_verifications').insert({
    user_id: user.id,
    school_email,
    code,
    expires_at: codeExpiresAt(now).toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // TODO: 実際のメール送信は未実装（メール配信基盤が未構築・本番導入前に解決必須）。
  // 現状は確認コードをDBに保存するのみで、送信経路は別途決定する必要がある。
  return NextResponse.json({ ok: true })
}
