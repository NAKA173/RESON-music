import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SupporterAgg {
  user_id: string
  display_name: string | null
  heart_count: number
  boost_count: number
  tip_total_yen: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) {
    return NextResponse.json({ error: 'アーティスト登録が必要です' }, { status: 403 })
  }

  const { data: tracks } = await supabase.from('tracks').select('id').eq('artist_id', artist.id)
  const trackIds = (tracks ?? []).map((t) => t.id)

  if (trackIds.length === 0) {
    return NextResponse.json({ supporters: [] })
  }

  const [supportsRes, boostsRes] = await Promise.all([
    supabase.from('supports').select('user_id, amount_yen').in('track_id', trackIds),
    supabase.from('boost_hearts').select('user_id').in('track_id', trackIds),
  ])

  const byUser = new Map<string, SupporterAgg>()

  for (const s of supportsRes.data ?? []) {
    const agg = byUser.get(s.user_id) ?? { user_id: s.user_id, display_name: null, heart_count: 0, boost_count: 0, tip_total_yen: 0 }
    if (s.amount_yen > 0) {
      agg.tip_total_yen += s.amount_yen
    } else {
      agg.heart_count += 1
    }
    byUser.set(s.user_id, agg)
  }

  for (const b of boostsRes.data ?? []) {
    const agg = byUser.get(b.user_id) ?? { user_id: b.user_id, display_name: null, heart_count: 0, boost_count: 0, tip_total_yen: 0 }
    agg.boost_count += 1
    byUser.set(b.user_id, agg)
  }

  const userIds = [...byUser.keys()]
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', userIds)

    for (const p of profiles ?? []) {
      const agg = byUser.get(p.user_id)
      if (agg) agg.display_name = p.display_name
    }
  }

  const supporters = [...byUser.values()].sort(
    (a, b) => (b.tip_total_yen + b.boost_count * 30) - (a.tip_total_yen + a.boost_count * 30)
  )

  return NextResponse.json({ supporters })
}
