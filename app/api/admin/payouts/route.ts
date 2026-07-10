import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('payout_requests')
    .select('id, artist_id, amount_yen, status, requested_at, artists ( id, name )')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}
