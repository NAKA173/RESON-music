import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { phone, token } = await req.json()

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
    await supabase.from('users').upsert(
      { id: userId, plan: 'free' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  }

  return NextResponse.json({ ok: true, user_id: userId })
}
