import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = (userData as { stripe_customer_id?: string })?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 404 })
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/pricing`,
  })

  return NextResponse.json({ url: session.url })
}
