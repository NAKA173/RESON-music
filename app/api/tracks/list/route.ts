import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const q = req.nextUrl.searchParams.get('q')

  let query = supabase
    .from('tracks')
    .select(`
      id,
      title,
      duration_sec,
      ai_generated,
      cumulative_plays,
      album_id,
      artists ( id, name )
    `)
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tracks: data })
}
