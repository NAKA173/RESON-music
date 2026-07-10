'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CuratorEntry {
  user_id: string
  display_name: string | null
  score: number
}

export default function CuratorsPage() {
  const [leaderboard, setLeaderboard] = useState<CuratorEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/curator/leaderboard')
      .then((r) => r.json())
      .then((d) => { setLeaderboard(d.leaderboard ?? []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">キュレーターランク</h1>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ
          </Link>
        </div>
        <p className="text-xs text-[var(--faint)]">
          まだ無名だった楽曲に早く応援し、後にその楽曲が伸びた場合にスコアが加算される「先見性」の指標です。
        </p>

        {loading ? (
          <p className="text-sm text-[var(--faint)]">読み込み中…</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-[var(--faint)] text-center py-8">まだランキングがありません</p>
        ) : (
          <div className="space-y-1">
            {leaderboard.map((c, i) => (
              <div key={c.user_id} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <span className="text-sm">
                  <span className="text-[var(--faint)] mr-3">#{i + 1}</span>
                  {c.display_name ?? '名無しのリスナー'}
                </span>
                <span className="text-sm font-bold text-[var(--accent)]">{c.score}pt</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
