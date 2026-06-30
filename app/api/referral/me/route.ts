import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('referral_code')
    .eq('id', user.id)
    .single()

  const { data: referrals, count } = await supabase
    .from('referrals')
    .select('created_at', { count: 'exact' })
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    referral_code: userRow?.referral_code ?? null,
    invited_count: count ?? 0,
    invited_at: (referrals ?? []).map((r) => r.created_at),
  })
}
