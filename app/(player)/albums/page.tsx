'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Player } from '@/components/Player'
import { usePlayerQueue } from '@/lib/player/queue'

interface AlbumTrack {
  id: string
  title: string
  duration_sec: number
  track_number: number | null
  cumulative_plays: number
  ai_generated: boolean
}

interface AlbumDetail {
  album: {
    id: string
    title: string
    cover_url: string | null
    cover_r2_key: string | null
    released_at: string | null
    release_type: 'single' | 'ep' | 'album'
    artists: { id: string; name: string } | null
  }
  tracks: AlbumTrack[]
  total_duration_sec: number
}

const RELEASE_TYPE_LABEL: Record<string, string> = {
  single: 'シングル',
  ep: 'EP',
  album: 'アルバム',
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}分${s}秒`
}

function AlbumDetailContent() {
  const searchParams = useSearchParams()
  const albumId = searchParams.get('id') ?? ''
  const [data, setData] = useState<AlbumDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const queue = usePlayerQueue(data?.tracks ?? [])

  useEffect(() => {
    if (!albumId) { setLoading(false); return }
    fetch(`/api/albums/${albumId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [albumId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--faint)]">
        読み込み中…
      </div>
    )
  }

  if (!data || !data.album) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--faint)]">
        アルバムが見つかりません
      </div>
    )
  }

  const { album, tracks, total_duration_sec } = data
  const current = queue.current
  const currentIdx = queue.baseIndex
  const nextTrackId = queue.queue[0]?.id ?? (queue.shuffleOn ? undefined : tracks[currentIdx + 1]?.id)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
          ← ホームへ
        </Link>

        <div className="flex gap-4">
          {(album.cover_r2_key || album.cover_url) && (
            <img
              src={album.cover_r2_key ? `/api/albums/${album.id}/cover` : album.cover_url!}
              alt={album.title}
              className="h-24 w-24 shrink-0 rounded-lg object-cover border border-[var(--line)]"
            />
          )}
          <div>
            <span className="text-xs rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--dim)]">
              {RELEASE_TYPE_LABEL[album.release_type] ?? 'アルバム'}
            </span>
            <h1 className="font-display mt-2 text-2xl font-bold">{album.title}</h1>
            <p className="mt-1 text-sm text-[var(--dim)]">{album.artists?.name ?? '不明なアーティスト'}</p>
            <p className="mt-1 text-xs text-[var(--faint)]">
              {tracks.length}曲・合計 {formatDuration(total_duration_sec)}
              {album.released_at && ` ・ ${new Date(album.released_at).toLocaleDateString('ja-JP')}`}
            </p>
          </div>
        </div>

        {current && (
          <Player
            track={{
              id: current.id,
              title: current.title,
              duration_sec: current.duration_sec,
              artists: album.artists,
            }}
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
        )}

        <div className="space-y-1">
          {tracks.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl transition ${
                i === currentIdx ? 'bg-[var(--surface)]' : 'hover:bg-[var(--panel)]'
              }`}
            >
              <button onClick={() => queue.playAt(i)} className="flex-1 flex items-center justify-between min-w-0 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-[var(--faint)] w-5 shrink-0">{t.track_number ?? i + 1}</span>
                  <span className={`truncate text-sm font-medium ${i === currentIdx ? 'text-[var(--accent)]' : ''}`}>
                    {t.title}
                    {t.ai_generated && <span className="ml-2 text-xs text-yellow-500">AI</span>}
                  </span>
                </div>
                <span className="text-xs text-[var(--faint)] shrink-0 ml-3">
                  {Math.floor(t.duration_sec / 60)}:{String(t.duration_sec % 60).padStart(2, '0')}
                </span>
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
        </div>
      </div>
    </div>
  )
}

export default function AlbumDetailPage() {
  return (
    <Suspense>
      <AlbumDetailContent />
    </Suspense>
  )
}
