import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// a→b または b→a のいずれかの方向でブロックされていれば true（フォロー・コメント等の相互作用を抑制する）
export async function isBlockedEitherWay(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> {
  // .or() フィルタ文字列への埋め込み前にUUID形式であることを検証する（インジェクション対策）
  if (!UUID_RE.test(userA) || !UUID_RE.test(userB)) return false

  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`
    )
    .limit(1)

  return (data?.length ?? 0) > 0
}
