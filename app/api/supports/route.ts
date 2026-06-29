import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'
import type { UserPlan } from '@/lib/distribution'

const TIP_FEE_RATE: Record<UserPlan, number> = {
  free: 0.15,
  standard: 0.08,
  student: 0.06,
  support_plus: 0, // 月末一括で別処理
}

const MIN_TIP_YEN = 100

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { track_id, amount_yen } = await req.json()

  if (!track_id) {
    return NextResponse.json({ error: 'track_id は必須です' }, { status: 400 })
  }

  // 投げ銭ありの場合は最低金額チェック
  if (amount_yen && amount_yen > 0 && amount_yen < MIN_TIP_YEN) {
    return NextResponse.json({ error: `投げ銭は${MIN_TIP_YEN}円以上です` }, { status: 400 })
  }

  const { data: track } = await supabase
    .from('tracks')
    .select('id')
    .eq('id', track_id)
    .single()

  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  // ❤️のみ（amount_yen = 0 or 未指定）
  if (!amount_yen || amount_yen === 0) {
    await supabase.from('supports').insert({
      track_id,
      user_id: user.id,
      amount_yen: 0,
    })
    return NextResponse.json({ ok: true, type: 'heart' })
  }

  // 投げ銭あり → Stripe PaymentIntent 作成
  const { data: userData } = await supabase
    .from('users')
    .select('plan, stripe_customer_id')
    .eq('id', user.id)
    .single()

  const plan = ((userData as { plan: string })?.plan ?? 'free') as UserPlan
  const feeRate = TIP_FEE_RATE[plan]

  // Support+ は月間蓄積なので PaymentIntent は作らず DB に記録
  if (plan === 'support_plus') {
    const { data: support } = await supabase
      .from('supports')
      .insert({ track_id, user_id: user.id, amount_yen })
      .select('id')
      .single()

    return NextResponse.json({ ok: true, type: 'tip_deferred', support_id: support?.id })
  }

  // 手数料込みの請求額
  const chargeYen = Math.ceil(amount_yen / (1 - feeRate))

  const customerId = (userData as { stripe_customer_id?: string })?.stripe_customer_id

  const paymentIntent = await stripe.paymentIntents.create({
    amount: chargeYen,
    currency: 'jpy',
    customer: customerId ?? undefined,
    metadata: { track_id, user_id: user.id, plan, net_yen: String(amount_yen) },
    automatic_payment_methods: { enabled: true },
  })

  return NextResponse.json({
    ok: true,
    type: 'tip',
    client_secret: paymentIntent.client_secret,
    charge_yen: chargeYen,
    net_yen: amount_yen,
    fee_rate: feeRate,
  })
}
