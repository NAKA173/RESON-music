import type { SupabaseClient } from '@supabase/supabase-js'

// 「まだ無名だった頃に応援した」楽曲が後で伸びた場合に加点する先見性スコア。
// 閾値は運用上の調整対象だが、不正検知の閾値とは異なり非公開にする必要はない。
export const EARLY_SUPPORT_THRESHOLD = 100 // この再生数未満での応援を「早期発見」とみなす
export const SUCCESS_THRESHOLD = 500 // 曲がこの再生数に達したら「見出しが当たった」とみなす

/**
 * 応援した時点の再生数（playsAtSupport）から先見性スコアの加点を算出する純粋関数。
 * 早ければ早いほど加点が大きい（0再生時点の応援で10点、99再生時点の応援で1点）。
 */
export function computeCuratorPoints(playsAtSupport: number): number {
  if (playsAtSupport >= EARLY_SUPPORT_THRESHOLD || playsAtSupport < 0) return 0
  return Math.ceil((EARLY_SUPPORT_THRESHOLD - playsAtSupport) / 10)
}

/**
 * 未集計（counted_for_curator=false）の応援のうち、対象楽曲が SUCCESS_THRESHOLD に
 * 達したものだけを集計し、curator_scores に加点する。まだ伸びていない曲の応援は
 * 次回以降のバッチで再評価されるよう counted_for_curator を立てない。
 */
export async function runCuratorBatch(supabase: SupabaseClient): Promise<{ awarded: number }> {
  const { data: candidates } = await supabase
    .from('supports')
    .select('id, user_id, track_id, track_plays_at_support')
    .eq('counted_for_curator', false)
    .not('track_plays_at_support', 'is', null)

  if (!candidates || candidates.length === 0) return { awarded: 0 }

  const trackIds = [...new Set(candidates.map((c) => c.track_id))]
  const { data: tracksData } = await supabase
    .from('tracks')
    .select('id, cumulative_plays')
    .in('id', trackIds)

  const playsByTrack = new Map((tracksData ?? []).map((t) => [t.id, t.cumulative_plays]))

  let awarded = 0
  for (const c of candidates) {
    const currentPlays = playsByTrack.get(c.track_id) ?? 0
    if (currentPlays < SUCCESS_THRESHOLD) continue

    const points = computeCuratorPoints(c.track_plays_at_support)
    if (points > 0) {
      const { data: existing } = await supabase
        .from('curator_scores')
        .select('score')
        .eq('user_id', c.user_id)
        .maybeSingle()

      await supabase.from('curator_scores').upsert({
        user_id: c.user_id,
        score: (existing?.score ?? 0) + points,
        updated_at: new Date().toISOString(),
      })
      awarded++
    }

    await supabase.from('supports').update({ counted_for_curator: true }).eq('id', c.id)
  }

  return { awarded }
}
