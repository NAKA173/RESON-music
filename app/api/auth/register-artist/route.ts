import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { name, bio, rights_confirmed, bank } = await req.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'アーティスト名は必須です' }, { status: 400 })
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'アーティスト名は100文字以内です' }, { status: 400 })
  }
  if (rights_confirmed !== true) {
    return NextResponse.json({ error: '権利確認への同意が必要です' }, { status: 400 })
  }
  if (
    !bank ||
    typeof bank.bank_name !== 'string' || !bank.bank_name.trim() ||
    typeof bank.branch_name !== 'string' || !bank.branch_name.trim() ||
    (bank.account_type !== 'ordinary' && bank.account_type !== 'checking') ||
    typeof bank.account_number !== 'string' || !bank.account_number.trim() ||
    typeof bank.account_holder_name !== 'string' || !bank.account_holder_name.trim()
  ) {
    return NextResponse.json({ error: '出金先の銀行口座情報は必須です' }, { status: 400 })
  }

  // 既に登録済みか確認
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'すでにアーティスト登録済みです' }, { status: 409 })
  }

  const { data: artist, error } = await supabase
    .from('artists')
    .insert({
      user_id: user.id,
      name: name.trim(),
      bio: bio?.trim() ?? null,
      review_status: 'pending',
      rights_confirmed: true,
      rights_confirmed_at: new Date().toISOString(),
    })
    .select('id, name, review_status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: bankError } = await supabase.from('artist_bank_accounts').insert({
    artist_id: artist.id,
    bank_name: bank.bank_name.trim(),
    branch_name: bank.branch_name.trim(),
    account_type: bank.account_type,
    account_number: bank.account_number.trim(),
    account_holder_name: bank.account_holder_name.trim(),
  })

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, artist })
}
