'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Distribution {
  year_month: string
  distribution_yen: number
  tips_yen: number
  score_breakdown: {
    play_time_score: number
    support_rate: number
    completion_rate: number
  }
}

interface Track {
  id: string
  title: string
  cumulative_plays: number
  in_distribution: boolean
  ai_generated: boolean
}

interface ReportData {
  artist: { id: string; name: string; review_status: string }
  balance: { balance_yen: number; dormant: boolean }
  distributions: Distribution[]
  tracks: Track[]
}

export default function ArtistReportPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/artist/report')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setSelectedMonth(d.distributions?.[0]?.year_month ?? null)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中…</p>
      </main>
    )
  }

  if (!data || !data.artist) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">アーティスト登録が必要です</p>
          <Link href="/register" className="text-white underline">登録する</Link>
        </div>
      </main>
    )
  }

  const month = data.distributions.find((d) => d.year_month === selectedMonth) ?? data.distributions[0]
  const totalPaid = data.distributions.reduce((sum, d) => sum + d.distribution_yen + (d.tips_yen ?? 0), 0)
  const distributedTracks = data.tracks.filter((t) => t.in_distribution)

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">月次レポート</h1>
            <p className="text-sm text-zinc-400">{data.artist.name}</p>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white underline">
            ダッシュボードへ
          </Link>
        </div>

        {data.distributions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-500">
            まだ分配履歴がありません。楽曲が100再生を超えると分配対象になります。
          </div>
        ) : (
          <>
            {/* 月選択 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.distributions.map((d) => (
                <button
                  key={d.year_month}
                  onClick={() => setSelectedMonth(d.year_month)}
                  className={`shrink-0 text-sm px-3 py-1.5 rounded-lg border transition ${
                    d.year_month === selectedMonth
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {d.year_month}
                </button>
              ))}
            </div>

            {month && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{month.year_month} の分配結果</h2>
                  <p className="text-2xl font-bold">
                    ¥{Math.floor(month.distribution_yen).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-4">
                  <FormulaRow
                    label="再生時間スコア"
                    weight={0.4}
                    value={month.score_breakdown.play_time_score}
                    formula="SUM(再生秒数 × プラン重み係数 × 秒数係数) / 3600"
                    note="プラン重み: Support+ 1.3 / Standard 1.0 / Student 0.7 / Free 0.4 / AI生成楽曲は0.1に固定"
                  />
                  <FormulaRow
                    label="応援率"
                    weight={0.35}
                    value={month.score_breakdown.support_rate * 100}
                    isPercent
                    formula="(応援数 + ブーストハート数 × 2.0) / 有効再生数"
                    note="有効再生数は再生秒数係数 > 0（30秒以上再生）のもののみ集計"
                  />
                  <FormulaRow
                    label="完聴率"
                    weight={0.25}
                    value={month.score_breakdown.completion_rate * 100}
                    isPercent
                    formula="完聴数 / 有効再生数"
                  />
                </div>

                <div className="border-t border-zinc-800 pt-4 text-sm text-zinc-400 space-y-1">
                  <p>raw_score = 再生時間スコア×0.4 + 応援率×0.35 + 完聴率×0.25</p>
                  <p>分配額 = 月間プール × (このアーティストのraw_score / 全アーティストのraw_score合計)</p>
                  <p className="text-zinc-600">投げ銭収益（別計算・分配プールを経由しない直接受取）: ¥{Math.floor(month.tips_yen ?? 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex justify-between text-sm">
              <span className="text-zinc-400">累計受取額（分配 + 投げ銭）</span>
              <span className="font-semibold">¥{Math.floor(totalPaid).toLocaleString()}</span>
            </div>
          </>
        )}

        {/* 楽曲別の分配対象状況 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">楽曲別ステータス</h2>
          <p className="text-xs text-zinc-600">
            cumulative_plays が100再生を超えた楽曲のみ分配対象（in_distribution = true）になります。
          </p>
          {data.tracks.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ楽曲がありません</p>
          ) : (
            data.tracks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <span className="truncate">{t.title}</span>
                <span className={t.in_distribution ? 'text-zinc-300' : 'text-zinc-600'}>
                  {t.in_distribution ? `分配対象（${t.cumulative_plays.toLocaleString()}再生）` : `${t.cumulative_plays}/100再生`}
                </span>
              </div>
            ))
          )}
          <p className="text-xs text-zinc-600 pt-1">分配対象楽曲数: {distributedTracks.length} / {data.tracks.length}</p>
        </div>

        <p className="text-center text-xs text-zinc-600">
          <Link href="/pricing" className="hover:text-zinc-400 underline">
            計算式・プール構成の全体はこちらで常時公開しています
          </Link>
        </p>
      </div>
    </main>
  )
}

function FormulaRow({
  label, weight, value, isPercent = false, formula, note,
}: {
  label: string
  weight: number
  value: number
  isPercent?: boolean
  formula: string
  note?: string
}) {
  const display = isPercent ? `${value.toFixed(1)}%` : value.toFixed(4)
  const pct = isPercent ? Math.min(value, 100) : Math.min(value * 100, 100)

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>
          {label}
          <span className="text-zinc-500 ml-1.5 text-xs">× {weight}</span>
        </span>
        <span className="text-zinc-300">{display}</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div className="bg-white h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zinc-600 mt-0.5">{formula}</p>
      {note && <p className="text-xs text-zinc-700 mt-0.5">{note}</p>}
    </div>
  )
}
