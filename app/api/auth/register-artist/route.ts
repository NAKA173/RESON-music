import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { name, bio } = await req.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'アーティスト名は必須です' }, { status: 400 })
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'アーティスト名は100文字以内です' }, { status: 400 })
  }

  // 既に登録済みか確認
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'すでにアーティスト登録済みです' }, { status: 409 })
  }

  const { data: artist, error } = await supabase
    .from('artists')
    .insert({
      user_id: user.id,
      name: name.trim(),
      bio: bio?.trim() ?? null,
    })
    .select('id, name')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, artist })
}
