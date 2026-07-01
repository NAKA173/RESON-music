'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Supporter {
  user_id: string
  display_name: string | null
  heart_count: number
  boost_count: number
  tip_total_yen: number
}

export default function SupportersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/artist/supporters')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setSupporters(d.supporters ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">支援者への感謝</h1>
            <p className="text-sm text-zinc-400 mt-1">
              あなたを応援してくれた方々です。感謝の気持ちを込めて、日々の投稿や音楽で応えてください。
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white underline">
            ダッシュボードへ
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : supporters.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-500 text-center">
            まだ支援者はいません。楽曲を届け続けましょう。
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            {supporters.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm">
                    🎧
                  </span>
                  <span className="text-sm">{s.display_name ?? '名無しのリスナー'}</span>
                </div>
                <div className="flex gap-4 text-xs text-zinc-500">
                  {s.heart_count > 0 && <span>❤️ {s.heart_count}</span>}
                  {s.boost_count > 0 && <span>🚀 {s.boost_count}</span>}
                  {s.tip_total_yen > 0 && <span className="text-zinc-300">💴 ¥{s.tip_total_yen.toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
