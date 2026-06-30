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

const navItems = [
  { href: '/', label: 'ホーム', icon: '⌂' },
  { href: '/search', label: 'さがす', icon: '⌕' },
  { href: '/explore', label: '探索', icon: '◎' },
]

const artists = [
  { name: 'ミナミ', genre: 'Lo-fi / Bedroom Pop', color: '#c8f23d', founding: true },
  { name: 'Kento Rui', genre: 'Alternative Rock', color: '#3dc8f2', founding: false },
  { name: '海音', genre: 'Ambient / Folk', color: '#f23d8c', founding: false },
  { name: 'ヨル猫', genre: 'City Pop', color: '#f2c83d', founding: true },
]

const explore = [
  { title: '深夜のドライブに', subtitle: '再生数100〜5,000の隠れた名曲', color: '#1a2e1a' },
  { title: '雨の日の朗読', subtitle: '知名度ではなく相性で出会う', color: '#1a1a2e' },
  { title: '誰も知らない名曲', subtitle: '探索モード限定の推薦', color: '#2e1a1a' },
]

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
  const heatTracks = tracks.slice(0, 8)

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* サイドバー */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)] p-6 sm:flex">
        <Link href="/" className="font-display text-xl font-bold">
          RESON
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/upload"
          className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm hover:border-[var(--accent)]"
        >
          <p className="font-medium">ライブラリを作ろう</p>
          <p className="mt-1 text-xs text-[var(--dim)]">楽曲をアップロードして配信を始める</p>
        </Link>
        <Link
          href="/dashboard"
          className="mt-auto text-xs text-[var(--faint)] hover:text-[var(--dim)]"
        >
          アーティストの方へ →
        </Link>
      </aside>

      {/* メイン */}
      <main className="flex-1 px-4 pb-24 pt-6 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-10">
          {/* トップバー */}
          <div className="flex items-center gap-4">
            <input
              disabled
              placeholder="アーティスト・楽曲・気分で探す"
              className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--faint)]"
            />
            <Link href="/pricing" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
              料金
            </Link>
            <Link href="/upload" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
              + アップロード
            </Link>
          </div>

          {/* プレイヤー / ピックアップ */}
          {loading ? (
            <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
          ) : current ? (
            <Player
              track={current}
              onEnded={() => setCurrentIdx((i) => Math.min(i + 1, tracks.length - 1))}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] py-20 text-center text-[var(--faint)]">
              <p>楽曲がありません</p>
              <Link href="/upload" className="mt-4 inline-block text-[var(--accent)] underline">
                最初の楽曲をアップロード
              </Link>
            </div>
          )}

          {/* 熱量が高まっている楽曲 */}
          {heatTracks.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold">熱量が高まっている楽曲</h2>
              <div className="scroll-x mt-4 gap-4 pb-2">
                {heatTracks.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setCurrentIdx(tracks.indexOf(t))}
                    className="flex w-40 shrink-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent)]"
                  >
                    <span
                      className="block aspect-square w-full rounded-lg"
                      style={{ backgroundColor: ['#c8f23d', '#3dc8f2', '#f23d8c', '#f2c83d'][i % 4] }}
                    />
                    <p className="mt-3 truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-[var(--dim)]">{t.artists?.name ?? '不明'}</p>
                    <p className="mt-1 text-xs text-[var(--faint)]">
                      {t.cumulative_plays}回再生
                      {t.ai_generated && <span className="ml-2 text-yellow-500">AI</span>}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 注目のアーティスト */}
          <section>
            <h2 className="font-display text-lg font-bold">注目のアーティスト</h2>
            <div className="scroll-x mt-4 gap-6 pb-2">
              {artists.map((a) => (
                <div key={a.name} className="flex w-24 shrink-0 flex-col items-center text-center">
                  <span
                    className="relative flex h-16 w-16 items-center justify-center rounded-full text-xs font-bold text-[var(--ink)]"
                    style={{ backgroundColor: a.color }}
                  >
                    {a.founding && (
                      <span className="absolute -right-1 -top-1 text-[var(--accent)]">★</span>
                    )}
                  </span>
                  <p className="mt-2 truncate text-xs font-medium">{a.name}</p>
                  <p className="truncate text-[10px] text-[var(--faint)]">{a.genre}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 探索モード */}
          <section>
            <h2 className="font-display text-lg font-bold">探索モード</h2>
            <p className="mt-1 text-xs text-[var(--faint)]">
              再生数 100〜5,000 の楽曲だけ。知名度ではなく相性で出会う
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {explore.map((e) => (
                <div
                  key={e.title}
                  className="relative aspect-video overflow-hidden rounded-xl border border-[var(--line)]"
                  style={{ backgroundColor: e.color }}
                >
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-sm font-bold">{e.title}</p>
                    <p className="text-xs text-[var(--dim)]">{e.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* トラックリスト */}
          {tracks.length > 0 && (
            <section className="space-y-1">
              <h2 className="font-display mb-2 text-lg font-bold">すべての楽曲</h2>
              {tracks.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition ${
                    i === currentIdx ? 'bg-[var(--surface)]' : 'hover:bg-[var(--panel)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${i === currentIdx ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-[var(--dim)]">
                        {t.artists?.name ?? '不明'}
                        {t.ai_generated && <span className="ml-2 text-yellow-500">AI</span>}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-xs text-[var(--faint)]">
                      {Math.floor(t.duration_sec / 60)}:{String(t.duration_sec % 60).padStart(2, '0')}
                    </div>
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      </main>

      {/* モバイルボトムナビ */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--line)] bg-[var(--panel)] sm:hidden">
        {navItems.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-[var(--dim)]"
          >
            <span>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
