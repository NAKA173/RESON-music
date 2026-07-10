import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { reviewTrack } from '@/lib/moderation/tracks'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { track_id, action } = await req.json()
  if (!track_id || (action !== 'approved' && action !== 'rejected')) {
    return NextResponse.json({ error: 'track_id と action("approved"|"rejected") は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()

  try {
    const track = await reviewTrack(service, track_id, action)
    return NextResponse.json({ ok: true, track })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
