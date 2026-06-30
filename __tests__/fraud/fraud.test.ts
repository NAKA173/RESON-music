import { checkPlayEvent, checkSameIpVolume, FRAUD_THRESHOLDS } from '@/lib/fraud'

function makeSupabaseMock({
  sameTrackCount = 0,
  highCompletionCount = 0,
  existingFlag = null as { id: string } | null,
}) {
  const inserted: unknown[] = []

  const supabase = {
    from: jest.fn(() => {
      const builder: Record<string, unknown> = {}
      builder.select = jest.fn(() => builder)
      builder.eq = jest.fn(() => builder)
      builder.gte = jest.fn(() => builder)
      builder.order = jest.fn(() => builder)
      builder.limit = jest.fn(() => builder)
      builder.maybeSingle = jest.fn(() => Promise.resolve({ data: existingFlag }))
      builder.insert = jest.fn((row: unknown) => {
        inserted.push(row)
        return Promise.resolve({ data: null, error: null })
      })
      // count クエリは select().eq()... の最後に await されるので thenable にする
      builder.then = (resolve: (v: { count: number }) => void) => {
        resolve({ count: sameTrackCount })
        return Promise.resolve()
      }
      return builder
    }),
  }

  return { supabase, inserted }
}

describe('checkPlayEvent', () => {
  test('閾値未満なら何もフラグを立てない', async () => {
    const { supabase, inserted } = makeSupabaseMock({ sameTrackCount: 0 })
    await checkPlayEvent(supabase as never, {
      trackId: 't1',
      userId: 'u1',
      playedSec: 100,
      durationSec: 200,
      completed: false,
    })
    expect(inserted).toHaveLength(0)
  })

  test('同一ユーザー×同一楽曲が閾値に達するとconcentrated_playsフラグが立つ', async () => {
    const { supabase, inserted } = makeSupabaseMock({
      sameTrackCount: FRAUD_THRESHOLDS.SAME_TRACK_MAX_PLAYS - 1,
    })
    await checkPlayEvent(supabase as never, {
      trackId: 't1',
      userId: 'u1',
      playedSec: 100,
      durationSec: 200,
      completed: false,
    })
    expect(inserted).toContainEqual(
      expect.objectContaining({ flag_type: 'concentrated_plays', level: 1 })
    )
  })

  test('既に未解決の同種フラグがある場合は重複insertしない', async () => {
    const { supabase, inserted } = makeSupabaseMock({
      sameTrackCount: FRAUD_THRESHOLDS.SAME_TRACK_MAX_PLAYS - 1,
      existingFlag: { id: 'existing' },
    })
    await checkPlayEvent(supabase as never, {
      trackId: 't1',
      userId: 'u1',
      playedSec: 100,
      durationSec: 200,
      completed: false,
    })
    expect(inserted).toHaveLength(0)
  })
})

describe('checkSameIpVolume', () => {
  test('閾値以上ならsame_ipフラグ（level 2）が立つ', async () => {
    const { supabase, inserted } = makeSupabaseMock({})
    await checkSameIpVolume(supabase as never, 't1', 'u1', FRAUD_THRESHOLDS.SAME_IP_MAX_PLAYS)
    expect(inserted).toContainEqual(
      expect.objectContaining({ flag_type: 'same_ip', level: 2 })
    )
  })

  test('閾値未満ならフラグを立てない', async () => {
    const { supabase, inserted } = makeSupabaseMock({})
    await checkSameIpVolume(supabase as never, 't1', 'u1', FRAUD_THRESHOLDS.SAME_IP_MAX_PLAYS - 1)
    expect(inserted).toHaveLength(0)
  })
})
