import { createServiceClient } from '@/lib/supabase/server'
import { runMonthlyDistribution } from '@/lib/distribution/batch'
import { NextRequest, NextResponse } from 'next/server'

// 管理者専用エンドポイント（Vercel Cron or 手動実行）
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { year_month } = await req.json()
  if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json({ error: 'year_month は "YYYY-MM" 形式で指定してください' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const result = await runMonthlyDistribution(supabase, year_month)

  // Support+ 投げ銭も同時精算
  await supabase.rpc('settle_support_plus_tips', { p_year_month: year_month })

  // 追加ブースト（サブスク請求合算分）も同時精算
  await supabase.rpc('settle_monthly_boosts', { p_year_month: year_month })

  return NextResponse.json({ ok: true, ...result })
}
