'use client'

import { useEffect, useState } from 'react'
import { Player } from '@/components/Player'
import { usePlayerQueue } from '@/lib/player/queue'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

interface Track {
  id: string
  title: string
  duration_sec: number
  ai_generated: boolean
  cumulative_plays: number
  artists: { id: string; name: string } | null
}

interface HeatTrack extends Track {
  completion_rate: number
  support_rate: number
  heat_score: number
}

interface ForYouTrack extends HeatTrack {
  because_you_like: boolean
}

const navItems = [
  { href: '/home', label: 'ホーム', icon: '⌂' },
  { href: '/search', label: 'さがす', icon: '⌕' },
  { href: '/explore', label: '探索', icon: '◎' },
  { href: '/feed', label: 'フィード', icon: '✎' },
  { href: '/library', label: 'ライブラリ', icon: '♥' },
  { href: '/playlists', label: 'プレイリスト', icon: '☰' },
  { href: '/notifications', label: '通知', icon: '🔔' },
  { href: '/wrapped', label: '年間まとめ', icon: '🎁' },
  { href: '/curators', label: 'キュレーター', icon: '🔎' },
  { href: '/messages', label: 'メッセージ', icon: '✉' },
]

const artists = [
  { name: 'ミナミ', genre: 'Lo-fi / Bedroom Pop', color: '#c8f23d', founding: true },
  { name: 'Kento Rui', genre: 'Alternative Rock', color: '#3dc8f2', founding: false },
  { name: '海音', genre: 'Ambient / Folk', color: '#f23d8c', founding: false },
  { name: 'ヨル猫', genre: 'City Pop', color: '#f2c83d', founding: true },
]

const exploreTileColors = ['#1a2e1a', '#1a1a2e', '#2e1a1a']

interface ExploreTrack {
  id: string
  title: string
  cumulative_plays: number
  artist: { id: string; name: string } | null
  genres: string[]
}

export default function PlayerPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [heatTracks, setHeatTracks] = useState<HeatTrack[]>([])
  const [forYouTracks, setForYouTracks] = useState<ForYouTrack[]>([])
  const [exploreTracks, setExploreTracks] = useState<ExploreTrack[]>([])
  const [loading, setLoading] = useState(true)
  const queue = usePlayerQueue(tracks)

  useEffect(() => {
    fetch('/api/tracks/list')
      .then((r) => r.json())
      .then((d) => {
        setTracks(d.tracks ?? [])
        setLoading(false)
      })
    fetch('/api/recommendations/heat')
      .then((r) => r.json())
      .then((d) => setHeatTracks(d.tracks ?? []))
    fetch('/api/recommendations/foryou')
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d) => setForYouTracks(d.tracks ?? []))
    fetch('/api/explore')
      .then((r) => r.json())
      .then((d) => setExploreTracks((d.tracks ?? []).slice(0, 3)))
  }, [])

  const current = queue.current
  const currentIdx = queue.baseIndex
  const nextIdx = queue.shuffleOn ? undefined : currentIdx + 1
  const nextTrackId = queue.queue[0]?.id ?? (nextIdx !== undefined ? tracks[nextIdx]?.id : undefined)

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
          href="/invite"
          className="mt-3 text-xs text-[var(--faint)] hover:text-[var(--dim)]"
        >
          友人を招待する →
        </Link>
        <Link
          href="/communities"
          className="mt-3 text-xs text-[var(--faint)] hover:text-[var(--dim)]"
        >
          コミュニティ →
        </Link>
        <Link
          href="/events"
          className="mt-1 text-xs text-[var(--faint)] hover:text-[var(--dim)]"
        >
          ライブ情報 →
        </Link>
        <Link
          href="/profile"
          className="mt-1 text-xs text-[var(--faint)] hover:text-[var(--dim)]"
        >
          音楽人格・プロフィール →
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
            <ThemeToggle />
          </div>

          {/* プレイヤー / ピックアップ */}
          {loading ? (
            <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
          ) : current ? (
            <Player
              track={current}
              onEnded={queue.playNext}
              nextTrackId={nextTrackId}
              controls={{
                onPrev: queue.playPrev,
                onNext: queue.playNext,
                hasNext: queue.hasNext,
                hasPrev: currentIdx > 0,
                shuffleOn: queue.shuffleOn,
                onToggleShuffle: queue.toggleShuffle,
                repeatMode: queue.repeatMode,
                onCycleRepeat: queue.cycleRepeat,
                queueCount: queue.queue.length,
              }}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] py-20 text-center text-[var(--faint)]">
              <p>楽曲がありません</p>
              <Link href="/upload" className="mt-4 inline-block text-[var(--accent)] underline">
                最初の楽曲をアップロード
              </Link>
            </div>
          )}

          {/* あなたへのおすすめ */}
          {forYouTracks.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold">あなたへのおすすめ</h2>
              <p className="mt-1 text-xs text-[var(--faint)]">
                よく聴いているアーティストの熱量が高い楽曲を優先表示
              </p>
              <div className="scroll-x mt-4 gap-4 pb-2">
                {forYouTracks.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const idx = tracks.findIndex((tr) => tr.id === t.id)
                      if (idx >= 0) queue.playAt(idx)
                    }}
                    className="flex w-40 shrink-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent)]"
                  >
                    <span
                      className="block aspect-square w-full rounded-lg"
                      style={{ backgroundColor: ['#3dc8f2', '#f23d8c', '#c8f23d', '#f2c83d'][i % 4] }}
                    />
                    <p className="mt-3 truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-[var(--dim)]">{t.artists?.name ?? '不明'}</p>
                    <p className="mt-1 text-xs text-[var(--faint)]">
                      {t.because_you_like ? (
                        <span className="text-[var(--accent)]">よく聴くアーティスト</span>
                      ) : (
                        `完聴率 ${Math.round(t.completion_rate * 100)}%`
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 熱量が高まっている楽曲 */}
          {heatTracks.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold">熱量が高まっている楽曲</h2>
              <p className="mt-1 text-xs text-[var(--faint)]">
                直近14日間の再生時間・応援率・完聴率から算出した熱量スコアが高い順
              </p>
              <div className="scroll-x mt-4 gap-4 pb-2">
                {heatTracks.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const idx = tracks.findIndex((tr) => tr.id === t.id)
                      if (idx >= 0) queue.playAt(idx)
                    }}
                    className="flex w-40 shrink-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent)]"
                  >
                    <span
                      className="block aspect-square w-full rounded-lg"
                      style={{ backgroundColor: ['#c8f23d', '#3dc8f2', '#f23d8c', '#f2c83d'][i % 4] }}
                    />
                    <p className="mt-3 truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-[var(--dim)]">{t.artists?.name ?? '不明'}</p>
                    <p className="mt-1 text-xs text-[var(--faint)]">
                      完聴率 {Math.round(t.completion_rate * 100)}% ・ 応援率 {Math.round(t.support_rate * 100)}%
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
          {exploreTracks.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">探索モード</h2>
                <Link href="/explore" className="text-xs text-[var(--dim)] hover:text-[var(--text)]">
                  すべて見る →
                </Link>
              </div>
              <p className="mt-1 text-xs text-[var(--faint)]">
                再生数 100〜5,000 の楽曲だけ。知名度ではなく相性で出会う
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {exploreTracks.map((t, i) => (
                  <div
                    key={t.id}
                    className="relative aspect-video overflow-hidden rounded-xl border border-[var(--line)]"
                    style={{ backgroundColor: exploreTileColors[i % exploreTileColors.length] }}
                  >
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-sm font-bold">{t.title}</p>
                      <p className="text-xs text-[var(--dim)]">{t.artist?.name ?? '不明'}</p>
                      {t.genres.length > 0 && (
                        <p className="mt-1 text-[10px] text-[var(--faint)]">{t.genres.join(' / ')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* トラックリスト */}
          {tracks.length > 0 && (
            <section className="space-y-1">
              <h2 className="font-display mb-2 text-lg font-bold">すべての楽曲</h2>
              {tracks.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl transition ${
                    i === currentIdx ? 'bg-[var(--surface)]' : 'hover:bg-[var(--panel)]'
                  }`}
                >
                  <button onClick={() => queue.playAt(i)} className="flex-1 min-w-0 text-left">
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
                  <button
                    onClick={() => queue.addToQueue(t)}
                    title="次に再生するキューへ追加"
                    className="shrink-0 text-xs text-[var(--faint)] hover:text-[var(--text)] px-2"
                  >
                    +キュー
                  </button>
                </div>
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
