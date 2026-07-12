import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('sender_id, recipient_id, body, track_id, read_at, created_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byPartner = new Map<string, { last_body: string; last_at: string; unread: boolean }>()
  for (const m of data ?? []) {
    const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id
    if (!byPartner.has(partnerId)) {
      byPartner.set(partnerId, {
        last_body: m.body || (m.track_id ? '♪ 曲を送信しました' : ''),
        last_at: m.created_at,
        unread: m.recipient_id === user.id && !m.read_at,
      })
    }
  }

  const partnerIds = [...byPartner.keys()]
  const { data: profiles } = partnerIds.length
    ? await supabase.from('user_profiles').select('user_id, display_name').in('user_id', partnerIds)
    : { data: [] }
  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]))

  const conversations = partnerIds.map((id) => ({
    user_id: id,
    display_name: nameByUser.get(id) ?? null,
    ...byPartner.get(id)!,
  }))

  return NextResponse.json({ conversations })
}
