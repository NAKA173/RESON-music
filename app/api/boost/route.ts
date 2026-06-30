import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

const FREE_BOOSTS_PER_MONTH = 3
const MAX_BOOSTS_PER_MONTH = 23
const BOOST_PRICE_YEN = 30

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const yearMonth = currentYearMonth()
  const { count } = await supabase
    .from('boost_hearts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('year_month', yearMonth)

  const used = count ?? 0
  return NextResponse.json({
    used,
    remaining: Math.max(MAX_BOOSTS_PER_MONTH - used, 0),
    free_remaining: Math.max(FREE_BOOSTS_PER_MONTH - used, 0),
    price_yen: BOOST_PRICE_YEN,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { track_id } = await req.json()
  if (!track_id) {
    return NextResponse.json({ error: 'track_id は必須です' }, { status: 400 })
  }

  const { data: track } = await supabase.from('tracks').select('id').eq('id', track_id).single()
  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  const yearMonth = currentYearMonth()
  const { count } = await supabase
    .from('boost_hearts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('year_month', yearMonth)

  const used = count ?? 0
  if (used >= MAX_BOOSTS_PER_MONTH) {
    return NextResponse.json({ error: `今月のブーストは${MAX_BOOSTS_PER_MONTH}回が上限です` }, { status: 429 })
  }

  // 無料分が残っている場合は即時記録
  if (used < FREE_BOOSTS_PER_MONTH) {
    const { error } = await supabase.from('boost_hearts').insert({
      track_id,
      user_id: user.id,
      year_month: yearMonth,
      amount_yen: 0,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, type: 'free', remaining: MAX_BOOSTS_PER_MONTH - used - 1 })
  }

  // 追加分は30円の決済を発生させる（Webhook成功時にboost_heartsへ記録・残高加算）
  const { data: userData } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: BOOST_PRICE_YEN,
    currency: 'jpy',
    customer: (userData as { stripe_customer_id?: string })?.stripe_customer_id ?? undefined,
    metadata: { type: 'boost', track_id, user_id: user.id, year_month: yearMonth },
    automatic_payment_methods: { enabled: true },
  })

  return NextResponse.json({
    ok: true,
    type: 'paid',
    client_secret: paymentIntent.client_secret,
    price_yen: BOOST_PRICE_YEN,
  })
}
