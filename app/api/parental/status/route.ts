import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('parent_user_id')
    .eq('id', user.id)
    .single()

  const { data: pending } = await supabase
    .from('parental_link_requests')
    .select('token')
    .eq('child_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  return NextResponse.json({
    linked: Boolean((userData as { parent_user_id?: string } | null)?.parent_user_id),
    pending_token: pending?.token ?? null,
  })
}
