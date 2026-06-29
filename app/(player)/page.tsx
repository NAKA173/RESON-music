'use client'

import { useEffect, useState } from 'react'
import { Player } from '@/components/Player'
import Link from 'next/link'

interface Track {
  id: string
  title: string
  duration_sec: number
  ai_generated: boolean
  cumulative_plays: number
  artists: { id: string; name: string } | null
}

export default function PlayerPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tracks/list')
      .then((r) => r.json())
      .then((d) => {
        setTracks(d.tracks ?? [])
        setLoading(false)
      })
  }, [])

  const current = tracks[currentIdx] ?? null

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">RESON</h1>
          <Link href="/upload" className="text-sm text-zinc-400 hover:text-white transition">
            + アップロード
          </Link>
        </div>

        {/* プレイヤー */}
        {loading ? (
          <div className="text-center text-zinc-500 py-20">読み込み中…</div>
        ) : current ? (
          <Player
            track={current}
            onEnded={() => setCurrentIdx((i) => Math.min(i + 1, tracks.length - 1))}
          />
        ) : (
          <div className="text-center text-zinc-500 py-20">
            <p>楽曲がありません</p>
            <Link href="/upload" className="mt-4 inline-block text-white underline">
              最初の楽曲をアップロード
            </Link>
          </div>
        )}

        {/* トラックリスト */}
        {tracks.length > 0 && (
          <div className="space-y-1">
            {tracks.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-full text-left px-4 py-3 rounded-xl transition ${
                  i === currentIdx ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${i === currentIdx ? 'text-white' : 'text-zinc-300'}`}>
                      {t.title}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {t.artists?.name ?? '不明'}
                      {t.ai_generated && <span className="ml-2 text-yellow-600">AI</span>}
                    </p>
                  </div>
                  <div className="text-xs text-zinc-600 ml-3 shrink-0">
                    {Math.floor(t.duration_sec / 60)}:{String(t.duration_sec % 60).padStart(2, '0')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
