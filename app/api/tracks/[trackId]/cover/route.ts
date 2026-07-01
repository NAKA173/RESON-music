import { createClient } from '@/lib/supabase/server'
import { getStreamUrl } from '@/lib/audio'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const supabase = await createClient()
  const { trackId } = await params

  const { data: track } = await supabase
    .from('tracks')
    .select('cover_r2_key')
    .eq('id', trackId)
    .single()

  if (!track?.cover_r2_key) {
    return NextResponse.json({ error: 'ジャケット画像が登録されていません' }, { status: 404 })
  }

  const url = await getStreamUrl(track.cover_r2_key)
  return NextResponse.redirect(url, { status: 302 })
}
