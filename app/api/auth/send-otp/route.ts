import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return NextResponse.json({ error: '電話番号の形式が正しくありません（例: +819012345678）' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
