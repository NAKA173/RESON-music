import { createServiceClient } from '@/lib/supabase/server'

export type NotificationType = 'follow' | 'like' | 'comment' | 'mention' | 'support' | 'new_track' | 'balance_threshold'

export async function createNotification(params: {
  userId: string
  type: NotificationType
  actorUserId?: string | null
  targetType?: string
  targetId?: string
}) {
  if (params.actorUserId && params.userId === params.actorUserId) return

  const supabase = await createServiceClient()
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    actor_user_id: params.actorUserId,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
  })
}
