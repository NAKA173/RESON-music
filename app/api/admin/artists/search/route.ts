import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || !q.trim()) {
    return NextResponse.json({ artists: [] })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('artists')
    .select('id, name, review_status, founding_artist')
    .ilike('name', `%${q.trim()}%`)
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ artists: data ?? [] })
}
