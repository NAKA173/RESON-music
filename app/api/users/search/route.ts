import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || !q.trim()) {
    return NextResponse.json({ users: [] })
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .ilike('display_name', `%${q.trim()}%`)
    .neq('user_id', user.id)
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
