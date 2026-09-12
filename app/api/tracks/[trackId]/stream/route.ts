import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStreamUrl } from '@/lib/audio'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { trackId } = await params

  const service = createServiceClient()
  const { data: track } = await service
    .from('tracks')
    .select('id, r2_key, duration_sec, review_status, fraud_suspended, artists ( user_id )')
    .eq('id', trackId)
    .single()

  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  const ownerUserId = (track.artists as unknown as { user_id: string } | null)?.user_id
  if (track.review_status !== 'approved' || track.fraud_suspended === true) {
    if (ownerUserId !== user.id) {
      return NextResponse.json({ error: 'この楽曲を再生する権限がありません' }, { status: 403 })
    }
  }

  const streamUrl = await getStreamUrl(track.r2_key)

  // クライアントをR2署名付きURLにリダイレクト
  // Range Requestはブラウザ ↔ R2 間で直接処理される
  return NextResponse.redirect(streamUrl, { status: 302 })
}
