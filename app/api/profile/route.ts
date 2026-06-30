import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_DISPLAY_NAME_LEN = 50
const MAX_BIO_LEN = 280
const MAX_PERSONA_TAGS = 10
const MAX_PERSONA_TAG_LEN = 30

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const userId = req.nextUrl.searchParams.get('user_id')

  let targetId = userId
  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    targetId = user.id
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, bio, persona_tags, avatar_url, updated_at')
    .eq('user_id', targetId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { display_name, bio, persona_tags, avatar_url } = await req.json()

  if (display_name && display_name.length > MAX_DISPLAY_NAME_LEN) {
    return NextResponse.json({ error: `表示名は${MAX_DISPLAY_NAME_LEN}文字以内です` }, { status: 400 })
  }
  if (bio && bio.length > MAX_BIO_LEN) {
    return NextResponse.json({ error: `自己紹介は${MAX_BIO_LEN}文字以内です` }, { status: 400 })
  }
  if (persona_tags !== undefined) {
    if (!Array.isArray(persona_tags) || persona_tags.length > MAX_PERSONA_TAGS
      || persona_tags.some((t) => typeof t !== 'string' || t.length > MAX_PERSONA_TAG_LEN)) {
      return NextResponse.json({ error: `音楽人格タグは${MAX_PERSONA_TAGS}個以内、各${MAX_PERSONA_TAG_LEN}文字以内です` }, { status: 400 })
    }
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      display_name: display_name ?? null,
      bio: bio ?? null,
      persona_tags: persona_tags ?? [],
      avatar_url: avatar_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('user_id, display_name, bio, persona_tags, avatar_url, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
