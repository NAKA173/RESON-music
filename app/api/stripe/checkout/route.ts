import { createClient } from '@/lib/supabase/server'
import { PLAN_PRICE_IDS } from '@/lib/stripe'
import { paymentProvider } from '@/lib/payment'
import { NextRequest, NextResponse } from 'next/server'
import type { PlanId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { plan } = await req.json() as { plan: PlanId }

  if (!PLAN_PRICE_IDS[plan]) {
    return NextResponse.json({ error: '不正なプランです' }, { status: 400 })
  }

  // Student プランは別途 .ed.jp 認証が必要（Phase 3 で実装）
  // ここでは DB フラグ確認のみ
  if (plan === 'student') {
    const { data: userData } = await supabase
      .from('users')
      .select('student_verified')
      .eq('id', user.id)
      .single()

    if (!userData?.student_verified) {
      return NextResponse.json(
        { error: 'Studentプランは学生認証が必要です（Phase 3 で実装予定）' },
        { status: 403 }
      )
    }
  }

  // Stripe CustomerID をメタデータに保存 or 既存を取得
  const { data: userData } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  // stripe_customer_id カラムは migration で追加（後述）
  let customerId = (userData as { stripe_customer_id?: string })?.stripe_customer_id

  if (!customerId) {
    const { customerId: newCustomerId } = await paymentProvider.createCustomer({
      metadata: { supabase_user_id: user.id },
    })
    customerId = newCustomerId
    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId } as never)
      .eq('id', user.id)
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const { url } = await paymentProvider.createSubscriptionCheckout({
    customerId,
    priceId: PLAN_PRICE_IDS[plan],
    successUrl: `${origin}/pricing?success=1`,
    cancelUrl: `${origin}/pricing`,
    metadata: { supabase_user_id: user.id, plan },
  })

  return NextResponse.json({ url })
}
