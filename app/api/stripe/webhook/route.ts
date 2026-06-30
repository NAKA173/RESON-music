import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Stripe webhook は冪等に実装（同一イベントが複数回届く前提）
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutCompleted(supabase, session)
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdated(supabase, sub)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionDeleted(supabase, sub)
      break
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      if (pi.metadata?.type === 'boost') {
        await handleBoostSucceeded(supabase, pi)
      } else {
        await handleTipSucceeded(supabase, pi)
      }
      break
    }
    default:
      // 未処理イベントは無視（200を返して再送させない）
      break
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.supabase_user_id
  const plan = session.metadata?.plan
  if (!userId || !plan) return

  await supabase
    .from('users')
    .update({ plan })
    .eq('id', userId)
}

async function handleSubscriptionUpdated(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  sub: Stripe.Subscription
) {
  const userId = sub.metadata?.supabase_user_id
  const plan = sub.metadata?.plan
  if (!userId || !plan) return

  const status = sub.status
  // active / trialing のみプランを維持。それ以外は free に戻す
  const newPlan = (status === 'active' || status === 'trialing') ? plan : 'free'

  await supabase
    .from('users')
    .update({ plan: newPlan })
    .eq('id', userId)
}

async function handleSubscriptionDeleted(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  sub: Stripe.Subscription
) {
  const userId = sub.metadata?.supabase_user_id
  if (!userId) return

  await supabase
    .from('users')
    .update({ plan: 'free' })
    .eq('id', userId)
}

async function handleTipSucceeded(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  pi: Stripe.PaymentIntent
) {
  const { track_id, user_id, net_yen } = pi.metadata ?? {}
  if (!track_id || !user_id || !net_yen) return

  // 冪等: payment_id で重複チェック
  const { data: existing } = await supabase
    .from('supports')
    .select('id')
    .eq('payment_id', pi.id)
    .single()
  if (existing) return

  await supabase.from('supports').insert({
    track_id,
    user_id,
    amount_yen: Number(net_yen),
    payment_id: pi.id,
  })
}

const BOOST_ARTIST_SHARE = 0.7 // 21円（70%）。残り30%は運営取得（投げ銭より高め）

async function handleBoostSucceeded(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  pi: Stripe.PaymentIntent
) {
  const { track_id, user_id, year_month } = pi.metadata ?? {}
  if (!track_id || !user_id || !year_month) return

  // 冪等: payment_id で重複チェック
  const { data: existing } = await supabase
    .from('boost_hearts')
    .select('id')
    .eq('payment_id', pi.id)
    .single()
  if (existing) return

  await supabase.from('boost_hearts').insert({
    track_id,
    user_id,
    year_month,
    amount_yen: 30,
    payment_id: pi.id,
  })

  const { data: track } = await supabase.from('tracks').select('artist_id').eq('id', track_id).single()
  if (!track) return

  // ブースト課金は月額プール按分を経由せず、アーティストへ直接送金（投げ銭と同方式）
  await supabase.rpc('add_artist_balance', {
    p_artist_id: track.artist_id,
    p_amount: 30 * BOOST_ARTIST_SHARE,
  })
}
