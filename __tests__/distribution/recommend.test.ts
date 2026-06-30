import { rankTracksByHeat } from '@/lib/distribution/recommend'
import type { TrackScore } from '@/lib/distribution/types'

function score(track_id: string, raw_score: number): TrackScore {
  return {
    track_id,
    artist_id: `artist-${track_id}`,
    play_time_score: raw_score,
    support_rate: 0,
    completion_rate: 0,
    raw_score,
  }
}

describe('rankTracksByHeat', () => {
  test('raw_score の降順に並べ替える', () => {
    const scores = [score('low', 0.1), score('high', 0.9), score('mid', 0.5)]
    const ranked = rankTracksByHeat(scores)
    expect(ranked.map((s) => s.track_id)).toEqual(['high', 'mid', 'low'])
  })

  test('limit を指定すると上位N件のみ返す', () => {
    const scores = [score('low', 0.1), score('high', 0.9), score('mid', 0.5)]
    const ranked = rankTracksByHeat(scores, 2)
    expect(ranked).toHaveLength(2)
    expect(ranked.map((s) => s.track_id)).toEqual(['high', 'mid'])
  })

  test('元の配列を変更しない', () => {
    const scores = [score('low', 0.1), score('high', 0.9)]
    const original = [...scores]
    rankTracksByHeat(scores)
    expect(scores).toEqual(original)
  })
})
