import { calcTrackScores, calcDistribution } from '@/lib/distribution/score'
import type { PlayEventRow } from '@/lib/distribution/types'

const tracks = [
  { track_id: 'track-A', artist_id: 'artist-1' },
  { track_id: 'track-B', artist_id: 'artist-2' },
]

describe('calcTrackScores', () => {
  test('再生なし → スコアなし', () => {
    const result = calcTrackScores([], [], tracks)
    expect(result).toHaveLength(0)
  })

  test('30秒未満（sec_factor=0）のみの再生はスコアに寄与しない', () => {
    const events: PlayEventRow[] = [
      { track_id: 'track-A', weight: 1.0, sec_factor: 0, completed: false },
    ]
    const result = calcTrackScores(events, [], tracks)
    const score = result.find((s) => s.track_id === 'track-A')
    expect(score?.support_rate).toBe(0)
    expect(score?.completion_rate).toBe(0)
  })

  test('play_time_score は weight × sec_factor の総和 / 3600', () => {
    const events: PlayEventRow[] = [
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
    ]
    const result = calcTrackScores(events, [], tracks)
    const score = result.find((s) => s.track_id === 'track-A')!
    expect(score.play_time_score).toBeCloseTo(2 / 3600)
  })

  test('support_rate = 応援数 / 有効再生数', () => {
    const events: PlayEventRow[] = [
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: false },
    ]
    const supports = [{ track_id: 'track-A', count: 1 }]
    const result = calcTrackScores(events, supports, tracks)
    const score = result.find((s) => s.track_id === 'track-A')!
    expect(score.support_rate).toBeCloseTo(0.25)
  })

  test('completion_rate = 完聴数 / 有効再生数', () => {
    const events: PlayEventRow[] = [
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: true },
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: true },
      { track_id: 'track-A', weight: 1.0, sec_factor: 0, completed: false }, // 無効
    ]
    const result = calcTrackScores(events, [], tracks)
    const score = result.find((s) => s.track_id === 'track-A')!
    expect(score.completion_rate).toBeCloseTo(1.0) // 2/2
  })

  test('raw_score = play_time×0.4 + support_rate×0.35 + completion_rate×0.25', () => {
    const events: PlayEventRow[] = [
      { track_id: 'track-A', weight: 1.0, sec_factor: 1.0, completed: true },
    ]
    const supports = [{ track_id: 'track-A', count: 1 }]
    const result = calcTrackScores(events, supports, tracks)
    const score = result.find((s) => s.track_id === 'track-A')!
    const expected =
      score.play_time_score * 0.4 +
      score.support_rate * 0.35 +
      score.completion_rate * 0.25
    expect(score.raw_score).toBeCloseTo(expected)
  })

  test('track_id に対応する artist_id がない場合はスキップ', () => {
    const events: PlayEventRow[] = [
      { track_id: 'unknown-track', weight: 1.0, sec_factor: 1.0, completed: false },
    ]
    const result = calcTrackScores(events, [], tracks)
    expect(result.find((s) => s.track_id === 'unknown-track')).toBeUndefined()
  })
})

describe('calcDistribution', () => {
  test('スコアが 0 なら空の Map を返す', () => {
    const result = calcDistribution([], 100000)
    expect(result.size).toBe(0)
  })

  test('アーティストが1人なら全額受け取る', () => {
    const scores = [
      {
        track_id: 'track-A',
        artist_id: 'artist-1',
        play_time_score: 1,
        support_rate: 0.5,
        completion_rate: 0.5,
        raw_score: 0.5,
      },
    ]
    const result = calcDistribution(scores, 100000)
    expect(result.get('artist-1')).toBeCloseTo(100000)
  })

  test('スコアが同じ2人なら折半', () => {
    const scores = [
      {
        track_id: 'track-A',
        artist_id: 'artist-1',
        play_time_score: 1,
        support_rate: 0.5,
        completion_rate: 0.5,
        raw_score: 0.5,
      },
      {
        track_id: 'track-B',
        artist_id: 'artist-2',
        play_time_score: 1,
        support_rate: 0.5,
        completion_rate: 0.5,
        raw_score: 0.5,
      },
    ]
    const result = calcDistribution(scores, 100000)
    expect(result.get('artist-1')).toBeCloseTo(50000)
    expect(result.get('artist-2')).toBeCloseTo(50000)
  })

  test('スコア比 2:1 なら 2/3 と 1/3 に分配', () => {
    const scores = [
      {
        track_id: 'track-A',
        artist_id: 'artist-1',
        play_time_score: 2,
        support_rate: 0,
        completion_rate: 0,
        raw_score: 2,
      },
      {
        track_id: 'track-B',
        artist_id: 'artist-2',
        play_time_score: 1,
        support_rate: 0,
        completion_rate: 0,
        raw_score: 1,
      },
    ]
    const result = calcDistribution(scores, 90000)
    expect(result.get('artist-1')).toBeCloseTo(60000)
    expect(result.get('artist-2')).toBeCloseTo(30000)
  })

  test('同一アーティストの複数トラックはスコアが合算される', () => {
    const scores = [
      {
        track_id: 'track-A',
        artist_id: 'artist-1',
        play_time_score: 1,
        support_rate: 0,
        completion_rate: 0,
        raw_score: 1,
      },
      {
        track_id: 'track-B',
        artist_id: 'artist-1',
        play_time_score: 1,
        support_rate: 0,
        completion_rate: 0,
        raw_score: 1,
      },
      {
        track_id: 'track-C',
        artist_id: 'artist-2',
        play_time_score: 2,
        support_rate: 0,
        completion_rate: 0,
        raw_score: 2,
      },
    ]
    const result = calcDistribution(scores, 100000)
    // artist-1: 2, artist-2: 2 → 折半
    expect(result.get('artist-1')).toBeCloseTo(50000)
    expect(result.get('artist-2')).toBeCloseTo(50000)
  })

  test('分配の合計はプール総額に等しい', () => {
    const scores = [
      { track_id: 't1', artist_id: 'a1', play_time_score: 3, support_rate: 0.2, completion_rate: 0.8, raw_score: 3 },
      { track_id: 't2', artist_id: 'a2', play_time_score: 1, support_rate: 0.1, completion_rate: 0.4, raw_score: 1 },
      { track_id: 't3', artist_id: 'a3', play_time_score: 2, support_rate: 0.5, completion_rate: 0.6, raw_score: 2 },
    ]
    const pool = 123456
    const result = calcDistribution(scores, pool)
    const total = [...result.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(pool)
  })
})
