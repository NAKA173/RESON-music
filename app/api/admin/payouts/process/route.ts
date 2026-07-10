import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { processPayoutRequest } from '@/lib/payout/process'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { request_id, action } = await req.json()
  if (!request_id || (action !== 'paid' && action !== 'rejected')) {
    return NextResponse.json({ error: 'request_id と action("paid"|"rejected") は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()

  try {
    const result = await processPayoutRequest(service, request_id, action)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
