import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { artist_id, founding_artist } = await req.json()
  if (!artist_id || typeof founding_artist !== 'boolean') {
    return NextResponse.json({ error: 'artist_id と founding_artist(bool) は必須です' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: artist, error } = await service
    .from('artists')
    .update({ founding_artist })
    .eq('id', artist_id)
    .select('id, name, founding_artist')
    .single()

  if (error || !artist) {
    return NextResponse.json({ error: error?.message ?? 'アーティストが見つかりません' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, artist })
}
