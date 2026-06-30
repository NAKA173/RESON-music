import type { TrackScore } from './types'

/**
 * ユーザーが過去によく聴いたアーティストの楽曲を優先表示するためのブースト。
 * affinity は artist_id ごとの 0〜1 の親和度（1 = 最も聴いているアーティスト）。
 * 親和度が高いほど raw_score を最大2倍まで増幅する。
 */
export function applyAffinityBoost(
  scores: TrackScore[],
  affinity: Map<string, number>
): TrackScore[] {
  return scores.map((s) => {
    const boost = affinity.get(s.artist_id) ?? 0
    return { ...s, raw_score: s.raw_score * (1 + boost) }
  })
}

/**
 * 再生履歴（artist_id ごとの play_time_score 相当の重み）から親和度を算出。
 * 最も聴いているアーティストが 1.0、それ以外は相対値になる。
 */
export function calcArtistAffinity(
  history: { artist_id: string; weight: number }[]
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const h of history) {
    totals.set(h.artist_id, (totals.get(h.artist_id) ?? 0) + h.weight)
  }
  const max = Math.max(0, ...totals.values())
  const affinity = new Map<string, number>()
  if (max === 0) return affinity
  for (const [artist_id, total] of totals) {
    affinity.set(artist_id, total / max)
  }
  return affinity
}
