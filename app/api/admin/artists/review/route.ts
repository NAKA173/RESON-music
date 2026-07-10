import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { artist_id, action } = await req.json()
  if (!artist_id || (action !== 'approved' && action !== 'rejected')) {
    return NextResponse.json({ error: 'artist_id と action("approved"|"rejected") は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: artist, error } = await service
    .from('artists')
    .update({ review_status: action, reviewed_at: new Date().toISOString() })
    .eq('id', artist_id)
    .eq('review_status', 'pending')
    .select('id, name, review_status')
    .single()

  if (error || !artist) {
    return NextResponse.json({ error: '審査待ちのアーティストが見つかりません' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, artist })
}
