import { createClient } from '@/lib/supabase/server'
import { detectAiGenerated } from '@/lib/audio/ai-detection'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/tracks/ai-check
 *
 * アップロード完了後に呼び出す。
 * 1. self_declared = true なら即 ai_generated = true に強制
 * 2. メタデータパターンでAIツール名を検出した場合も強制
 * 3. 検出結果を tracks に保存し、アーティストに通知内容を返す
 *
 * ai_generated = true になると calcWeight() が 0.1 を返す（分配重みが最小になる）
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { track_id, self_declared, metadata } = await req.json()

  if (!track_id) {
    return NextResponse.json({ error: 'track_id は必須です' }, { status: 400 })
  }

  const { data: track } = await supabase
    .from('tracks')
    .select('id, title, ai_generated, artists!inner(user_id)')
    .eq('id', track_id)
    .single()

  if (!track) {
    return NextResponse.json({ error: '楽曲が見つかりません' }, { status: 404 })
  }

  const artistData = Array.isArray(track.artists) ? track.artists[0] : track.artists
  if ((artistData as { user_id: string })?.user_id !== user.id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const result = detectAiGenerated({
    title: track.title,
    selfDeclared: self_declared ?? false,
    metadata,
  })

  // ai_generated が変わる場合のみ更新
  if (result.ai_generated !== track.ai_generated) {
    await supabase
      .from('tracks')
      .update({ ai_generated: result.ai_generated })
      .eq('id', track_id)
  }

  const messages: Record<AiDetectionResult['reason'], string> = {
    self_declared: 'AI生成楽曲として登録しました。分配重み係数は 0.1 になります。',
    metadata_pattern:
      'ファイルのメタデータからAI生成ツールが検出されたため、AI生成楽曲として自動登録しました。分配重み係数は 0.1 になります。',
    not_detected: '',
  }

  return NextResponse.json({
    ok: true,
    ai_generated: result.ai_generated,
    reason: result.reason,
    message: messages[result.reason],
  })
}

interface AiDetectionResult {
  reason: 'self_declared' | 'metadata_pattern' | 'not_detected'
}
