import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: scores, error } = await supabase
    .from('curator_scores')
    .select('user_id, score')
    .order('score', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (scores ?? []).map((s) => s.user_id)
  const { data: profiles } = userIds.length
    ? await supabase.from('user_profiles').select('user_id, display_name').in('user_id', userIds)
    : { data: [] }

  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]))

  const leaderboard = (scores ?? []).map((s) => ({
    user_id: s.user_id,
    display_name: nameByUser.get(s.user_id) ?? null,
    score: s.score,
  }))

  return NextResponse.json({ leaderboard })
}
