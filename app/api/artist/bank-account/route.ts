import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function mask(accountNumber: string) {
  if (accountNumber.length <= 4) return accountNumber
  return `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  const { data: bank } = await supabase
    .from('artist_bank_accounts')
    .select('bank_name, branch_name, account_type, account_number, account_holder_name, updated_at')
    .eq('artist_id', artist.id)
    .single()

  if (!bank) {
    return NextResponse.json({ bank_account: null })
  }

  return NextResponse.json({
    bank_account: { ...bank, account_number: mask(bank.account_number) },
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  const { bank_name, branch_name, account_type, account_number, account_holder_name } = await req.json()

  if (
    typeof bank_name !== 'string' || !bank_name.trim() ||
    typeof branch_name !== 'string' || !branch_name.trim() ||
    (account_type !== 'ordinary' && account_type !== 'checking') ||
    typeof account_number !== 'string' || !account_number.trim() ||
    typeof account_holder_name !== 'string' || !account_holder_name.trim()
  ) {
    return NextResponse.json({ error: '出金先の銀行口座情報が不正です' }, { status: 400 })
  }

  const { error } = await supabase
    .from('artist_bank_accounts')
    .update({
      bank_name: bank_name.trim(),
      branch_name: branch_name.trim(),
      account_type,
      account_number: account_number.trim(),
      account_holder_name: account_holder_name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('artist_id', artist.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
