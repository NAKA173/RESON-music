import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 管理者専用エンドポイント（楽曲登録審査の承認/却下・手動運用を前提とした最小実装）
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { track_id, action } = await req.json()
  if (!track_id || (action !== 'approved' && action !== 'rejected')) {
    return NextResponse.json({ error: 'track_id と action("approved"|"rejected") は必須です' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data: track, error } = await supabase
    .from('tracks')
    .update({ review_status: action, reviewed_at: new Date().toISOString() })
    .eq('id', track_id)
    .eq('review_status', 'pending')
    .select('id, title, review_status')
    .single()

  if (error || !track) {
    return NextResponse.json({ error: '審査待ちの楽曲が見つかりません' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, track })
}
