import { createClient } from '@/lib/supabase/server'

// 人力審査ダッシュボード用の管理者判定。CRON_SECRET運用（自動バッチ）とは別に、
// ブラウザからログインして操作するための最小限のロール判定（users.is_admin）。
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false }

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return { supabase, user, isAdmin: data?.is_admin === true }
}
