'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RankedTrack {
  id: string
  title: string
  cumulative_plays: number
  artists: { id: string; name: string } | null
  this_week_boosts: number
  last_week_boosts: number
  growth_rate: number
}

export default function BoostRankingPage() {
  const [tracks, setTracks] = useState<RankedTrack[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/boost/weekly-ranking')
      .then((r) => r.json())
      .then((d) => { setTracks(d.tracks ?? []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">週間ブーストランキング🚀</h1>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ
          </Link>
        </div>
        <p className="text-xs text-[var(--faint)]">
          先週比の伸び率が高い曲（累計再生数500以上）が対象です。絶対的なブースト数ではなく、
          今まさに勢いのある曲を発見できます。
        </p>

        {loading ? (
          <p className="text-sm text-[var(--faint)]">読み込み中…</p>
        ) : tracks.length === 0 ? (
          <p className="text-sm text-[var(--faint)] text-center py-8">まだランキングがありません</p>
        ) : (
          <div className="space-y-1">
            {tracks.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    <span className="text-[var(--faint)] mr-2">#{i + 1}</span>
                    {t.title}
                  </p>
                  <p className="text-xs text-[var(--dim)] ml-6">{t.artists?.name ?? '不明'}</p>
                </div>
                <span className="text-xs text-[var(--accent)] shrink-0 ml-2">
                  今週🚀{t.this_week_boosts}（先週{t.last_week_boosts}）
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
