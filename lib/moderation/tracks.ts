import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/sns/notify'

export async function reviewTrack(
  supabase: SupabaseClient,
  trackId: string,
  action: 'approved' | 'rejected'
) {
  const { data: track, error } = await supabase
    .from('tracks')
    .update({ review_status: action, reviewed_at: new Date().toISOString() })
    .eq('id', trackId)
    .eq('review_status', 'pending')
    .select('id, title, review_status, artist_id')
    .single()

  if (error || !track) {
    throw new Error('審査待ちの楽曲が見つかりません')
  }

  // 承認＝配信開始のタイミングで、そのアーティストをフォローしているユーザーへ新曲通知を送る
  if (action === 'approved') {
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followee_type', 'artist')
      .eq('followee_id', track.artist_id)

    for (const f of followers ?? []) {
      await createNotification({
        userId: f.follower_id,
        type: 'new_track',
        actorUserId: null,
        targetType: 'track',
        targetId: track.id,
      })
    }
  }

  return track
}
