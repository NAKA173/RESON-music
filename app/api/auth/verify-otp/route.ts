import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { phone, token, ref } = await req.json()

  if (!phone || !token) {
    return NextResponse.json({ error: 'phone と token は必須です' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // users テーブルに upsert（初回ログイン時のみ INSERT される）
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

  return NextResponse.json({ ok: true, user_id: userId })
}
