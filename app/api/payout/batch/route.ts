import { createServiceClient } from '@/lib/supabase/server'
import { checkBalanceNotifications, checkDormantAccounts } from '@/lib/payout/process'
import { NextRequest, NextResponse } from 'next/server'

// 管理者専用エンドポイント（Vercel Cron or 手動実行・毎月の締め処理で実行する前提）
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const notifyResult = await checkBalanceNotifications(supabase)
  const dormantResult = await checkDormantAccounts(supabase)

  return NextResponse.json({ ok: true, ...notifyResult, ...dormantResult })
}
