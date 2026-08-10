import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password, ref } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // users テーブルに upsert（初回登録時のみ INSERT される）
  const userId = data.user?.id
  if (userId) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    const isNewUser = !existingUser

    await supabase.from('users').upsert(
      { id: userId, plan: 'free' },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    // 紹介制：新規ユーザーが ?ref=コード 付きリンクから来た場合のみ記録する（特典なし）
    if (isNewUser && typeof ref === 'string' && ref.trim()) {
      const serviceClient = await createServiceClient()
      const { data: referrer } = await serviceClient
        .from('users')
        .select('id')
        .eq('referral_code', ref.trim())
        .maybeSingle()

      if (referrer && referrer.id !== userId) {
        await serviceClient.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: userId,
        })
      }
    }
  }

  // Supabase側でメール確認が有効な場合、session は null で返る（確認リンククリック後にログイン可能）
  return NextResponse.json({
    ok: true,
    user_id: userId,
    needs_email_confirmation: !data.session,
  })
}
