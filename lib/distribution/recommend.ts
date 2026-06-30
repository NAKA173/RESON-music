import type { TrackScore } from './types'

/**
 * raw_score（熱量スコア）が高い順に並べる。
 * 直近ウィンドウの play_events から calcTrackScores で算出した結果を渡す想定。
 */
export function rankTracksByHeat(scores: TrackScore[], limit?: number): TrackScore[] {
  const sorted = [...scores].sort((a, b) => b.raw_score - a.raw_score)
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
}
