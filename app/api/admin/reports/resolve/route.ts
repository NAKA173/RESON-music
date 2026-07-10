import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { id, status } = await req.json()
  if (!id || (status !== 'reviewed' && status !== 'dismissed')) {
    return NextResponse.json({ error: 'id と status("reviewed"|"dismissed") は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service.from('reports').update({ status }).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
