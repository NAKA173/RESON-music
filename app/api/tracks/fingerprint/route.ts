import { createClient } from '@/lib/supabase/server'
import { lookupFingerprint, isDuplicateInDb } from '@/lib/audio/fingerprint'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/tracks/fingerprint
 *
 * クライアント（lib/audio/client-fingerprint.ts の簡易フィンガープリント。
 * 真のChromaprint WASMではない）からフィンガープリントを受け取り：
 * 1. DB内重複チェック（RESON内の完全一致・ほぼ一致を検知。主目的）
 * 2. AcoustID API で既存楽曲照合（簡易フィンガープリントのため実質常に不一致になる。
 *    将来Chromaprint WASMを統合すればここが機能するようになる）
 * 3. tracks.fingerprint を保存
 *
 * 重複検出時は 409 を返す（UI でアーティストに通知）
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { track_id, fingerprint, duration_sec } = await req.json()

  if (!track_id || !fingerprint || !duration_sec) {
    return NextResponse.json(
      { error: 'track_id / fingerprint / duration_sec は必須です' },
      { status: 400 }
    )
  }

  // 自分の楽曲か確認
  const { data: track } = await supabase
    .from('tracks')
    .select('id, artist_id, artists!inner(user_id)')
    .eq('id', track_id)
    .single()

  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  const artistData = Array.isArray(track.artists) ? track.artists[0] : track.artists
  if ((artistData as { user_id: string })?.user_id !== user.id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  // ① DB 内重複チェック
  const dbCheck = await isDuplicateInDb(supabase, fingerprint, track_id)
  if (dbCheck.duplicate) {
    return NextResponse.json(
      {
        error: '同一の楽曲が既に登録されています',
        duplicate: true,
        existing_track_id: dbCheck.existingTrackId,
      },
      { status: 409 }
    )
  }

  // ② AcoustID API 照合（非同期・結果はメタデータとして保存のみ）
  const acoustResult = await lookupFingerprint(fingerprint, duration_sec)

  // ③ fingerprint を tracks に保存
  await supabase
    .from('tracks')
    .update({ fingerprint })
    .eq('id', track_id)

  return NextResponse.json({
    ok: true,
    acoustid_matched: acoustResult.matched,
    acoustid: acoustResult.acoustid ?? null,
    mb_title: acoustResult.mbTitle ?? null,
    mb_artist: acoustResult.mbArtist ?? null,
  })
}
