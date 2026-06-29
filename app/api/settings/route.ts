import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ settings: data ?? {} })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const patch = await req.json()

  await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
