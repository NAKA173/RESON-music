import { createClient } from '@/lib/supabase/server'
import { isCodeExpired, MAX_VERIFY_ATTEMPTS } from '@/lib/student/verify'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { code } = await req.json()
  if (!code) {
    return NextResponse.json({ error: 'code は必須です' }, { status: 400 })
  }

  const { data: verification } = await supabase
    .from('student_verifications')
    .select('id, code, expires_at, attempts, verified')
    .eq('user_id', user.id)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!verification) {
    return NextResponse.json({ error: '認証コードのリクエストが見つかりません' }, { status: 404 })
  }

  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json({ error: '試行回数の上限に達しました。再度コードを送信してください' }, { status: 429 })
  }

  if (isCodeExpired(new Date(verification.expires_at), new Date())) {
    return NextResponse.json({ error: 'コードの有効期限が切れています。再度送信してください' }, { status: 400 })
  }

  if (verification.code !== code) {
    await supabase
      .from('student_verifications')
      .update({ attempts: verification.attempts + 1 })
      .eq('id', verification.id)
    return NextResponse.json({ error: 'コードが一致しません' }, { status: 400 })
  }

  await supabase
    .from('student_verifications')
    .update({ verified: true })
    .eq('id', verification.id)

  await supabase
    .from('users')
    .update({ student_verified: true })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
