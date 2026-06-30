import { applyAffinityBoost, calcArtistAffinity } from '@/lib/distribution/personalize'
import type { TrackScore } from '@/lib/distribution/types'

function score(track_id: string, artist_id: string, raw_score: number): TrackScore {
  return {
    track_id,
    artist_id,
    play_time_score: raw_score,
    support_rate: 0,
    completion_rate: 0,
    raw_score,
  }
}

describe('calcArtistAffinity', () => {
  test('履歴なしなら空のMap', () => {
    expect(calcArtistAffinity([]).size).toBe(0)
  })

  test('最も聴いているアーティストが1.0になる', () => {
    const affinity = calcArtistAffinity([
      { artist_id: 'A', weight: 10 },
      { artist_id: 'A', weight: 10 },
      { artist_id: 'B', weight: 5 },
    ])
    expect(affinity.get('A')).toBe(1)
    expect(affinity.get('B')).toBe(0.25)
  })
})

describe('applyAffinityBoost', () => {
  test('親和度0のアーティストはスコアが変わらない', () => {
    const scores = [score('t1', 'A', 1.0)]
    const result = applyAffinityBoost(scores, new Map())
    expect(result[0].raw_score).toBe(1.0)
  })

  test('親和度1.0のアーティストはスコアが2倍になる', () => {
    const scores = [score('t1', 'A', 1.0)]
    const result = applyAffinityBoost(scores, new Map([['A', 1.0]]))
    expect(result[0].raw_score).toBe(2.0)
  })

  test('親和度に応じて他アーティストより上位になりうる', () => {
    const scores = [score('low-affinity', 'B', 1.0), score('high-affinity', 'A', 0.6)]
    const result = applyAffinityBoost(scores, new Map([['A', 1.0]]))
    const sorted = [...result].sort((a, b) => b.raw_score - a.raw_score)
    expect(sorted[0].track_id).toBe('high-affinity')
  })
})
