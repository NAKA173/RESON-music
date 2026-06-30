import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 応援の連鎖表示（Support Graph）：自分がフォローしているユーザーのうち、
// この楽曲を応援（❤️/投げ銭/ブースト）した人を表示する。閲覧専用・集計は軽量に。
export async function GET(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: followRows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
    .eq('followee_type', 'user')

  const followeeIds = (followRows ?? []).map((f: { followee_id: string }) => f.followee_id)

  if (followeeIds.length === 0) {
    return NextResponse.json({ supporters: [], total_support_count: 0 })
  }

  const [supportsRes, boostsRes, totalRes] = await Promise.all([
    supabase
      .from('supports')
      .select('user_id')
      .eq('track_id', trackId)
      .in('user_id', followeeIds),
    supabase
      .from('boost_hearts')
      .select('user_id')
      .eq('track_id', trackId)
      .in('user_id', followeeIds),
    supabase
      .from('supports')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', trackId),
  ])

  const supporterIds = [...new Set([
    ...(supportsRes.data ?? []).map((s: { user_id: string }) => s.user_id),
    ...(boostsRes.data ?? []).map((b: { user_id: string }) => b.user_id),
  ])]

  if (supporterIds.length === 0) {
    return NextResponse.json({ supporters: [], total_support_count: totalRes.count ?? 0 })
  }

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', supporterIds)

  const profileMap = new Map((profiles ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]))

  const supporters = supporterIds.map((id) => ({
    user_id: id,
    display_name: profileMap.get(id) ?? null,
  }))

  return NextResponse.json({ supporters, total_support_count: totalRes.count ?? 0 })
}
