import { createClient } from '@/lib/supabase/server'
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

  const { data: track } = await supabase
    .from('tracks')
    .select('id, r2_key, duration_sec')
    .eq('id', trackId)
    .single()

  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  const streamUrl = await getStreamUrl(track.r2_key)

  // クライアントをR2署名付きURLにリダイレクト
  // Range Requestはブラウザ ↔ R2 間で直接処理される
  return NextResponse.redirect(streamUrl, { status: 302 })
}
