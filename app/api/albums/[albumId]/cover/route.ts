import { createClient } from '@/lib/supabase/server'
import { getStreamUrl } from '@/lib/audio'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const supabase = await createClient()
  const { albumId } = await params

  const { data: album } = await supabase
    .from('albums')
    .select('cover_r2_key')
    .eq('id', albumId)
    .single()

  if (!album?.cover_r2_key) {
    return NextResponse.json({ error: 'ジャケット画像が登録されていません' }, { status: 404 })
  }

  const url = await getStreamUrl(album.cover_r2_key)
  return NextResponse.redirect(url, { status: 302 })
}
