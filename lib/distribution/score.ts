import type { PlayEventRow, TrackScore } from './types'

interface SupportCount {
  track_id: string
  count: number
}

interface TrackMeta {
  track_id: string
  artist_id: string
}

const WEIGHT_PLAY_TIME = 0.4
const WEIGHT_SUPPORT_RATE = 0.35
const WEIGHT_COMPLETION_RATE = 0.25
const BOOST_HEART_WEIGHT = 2.0 // ブーストハートは応援度スコアへ重み2倍で反映（第8章）

export function calcTrackScores(
  events: PlayEventRow[],
  supports: SupportCount[],
  tracks: TrackMeta[],
  boosts: SupportCount[] = []
): TrackScore[] {
  const supportMap = new Map(supports.map((s) => [s.track_id, s.count]))
  const boostMap = new Map(boosts.map((b) => [b.track_id, b.count]))
  const trackMap = new Map(tracks.map((t) => [t.track_id, t.artist_id]))

  // track_id ごとにイベントをグループ化
  const byTrack = new Map<string, PlayEventRow[]>()
  for (const ev of events) {
    const list = byTrack.get(ev.track_id) ?? []
    list.push(ev)
    byTrack.set(ev.track_id, list)
  }

  const scores: TrackScore[] = []

  for (const [track_id, evs] of byTrack) {
    const artist_id = trackMap.get(track_id)
    if (!artist_id) continue

    // sec_factor > 0 のみ有効再生
    const valid = evs.filter((e) => e.sec_factor > 0)

    const play_time_score =
      evs.reduce((sum, e) => {
        // played_sec はここでは weight × sec_factor の積として扱う
        // （実際のplayed_secはplay_eventsに記録済み。ここはスコア計算のみ）
        return sum + e.weight * e.sec_factor
      }, 0) / 3600

    const supportCount = supportMap.get(track_id) ?? 0
    const boostCount = boostMap.get(track_id) ?? 0
    const support_rate = valid.length > 0
      ? (supportCount + boostCount * BOOST_HEART_WEIGHT) / valid.length
      : 0

    const completedCount = valid.filter((e) => e.completed).length
    const completion_rate = valid.length > 0 ? completedCount / valid.length : 0

    const raw_score =
      play_time_score * WEIGHT_PLAY_TIME +
      support_rate * WEIGHT_SUPPORT_RATE +
      completion_rate * WEIGHT_COMPLETION_RATE

    scores.push({
      track_id,
      artist_id,
      play_time_score,
      support_rate,
      completion_rate,
      raw_score,
    })
  }

  return scores
}

export function calcDistribution(
  scores: TrackScore[],
  totalPoolYen: number
): Map<string, number> {
  // artist_id ごとに raw_score を合算
  const artistScores = new Map<string, number>()
  for (const s of scores) {
    artistScores.set(s.artist_id, (artistScores.get(s.artist_id) ?? 0) + s.raw_score)
  }

  const totalScore = [...artistScores.values()].reduce((a, b) => a + b, 0)

  const result = new Map<string, number>()
  if (totalScore === 0) return result

  for (const [artist_id, score] of artistScores) {
    result.set(artist_id, totalPoolYen * (score / totalScore))
  }

  return result
}
