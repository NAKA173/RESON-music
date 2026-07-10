import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { id, unsuspend } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'id は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: flag, error } = await service
    .from('fraud_flags')
    .update({ resolved: true })
    .eq('id', id)
    .select('track_id')
    .single()

  if (error || !flag) {
    return NextResponse.json({ error: error?.message ?? 'フラグが見つかりません' }, { status: 500 })
  }

  if (unsuspend) {
    await service.from('tracks').update({ fraud_suspended: false }).eq('id', flag.track_id)
  }

  return NextResponse.json({ ok: true })
}
