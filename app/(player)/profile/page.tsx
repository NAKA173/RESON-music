'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const MAX_BEST_TRACKS = 10

interface TrackOption {
  id: string
  title: string
  artists: { id: string; name: string } | null
}

interface BestTrackEntry {
  rank: number
  track_id: string
  tracks: TrackOption | null
}

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [personaTags, setPersonaTags] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [bestTracks, setBestTracks] = useState<BestTrackEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TrackOption[]>([])
  const [bestTracksError, setBestTracksError] = useState('')
  const [bestTracksSaved, setBestTracksSaved] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setDisplayName(d.profile.display_name ?? '')
          setBio(d.profile.bio ?? '')
          setPersonaTags((d.profile.persona_tags ?? []).join(', '))
        }
        setLoading(false)
      })
    loadBestTracks()
  }, [])

  function loadBestTracks() {
    fetch('/api/best-tracks')
      .then((r) => r.json())
      .then((d) => setBestTracks(d.best_tracks ?? []))
  }

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/tracks/list?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.tracks ?? []))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function addBestTrack(track: TrackOption) {
    if (bestTracks.some((b) => b.track_id === track.id)) return
    if (bestTracks.length >= MAX_BEST_TRACKS) {
      setBestTracksError(`ランキングは${MAX_BEST_TRACKS}件までです`)
      return
    }
    setBestTracksError('')
    setBestTracks((prev) => [...prev, { rank: prev.length + 1, track_id: track.id, tracks: track }])
    setSearchQuery('')
    setSearchResults([])
  }

  function removeBestTrack(trackId: string) {
    setBestTracks((prev) =>
      prev.filter((b) => b.track_id !== trackId).map((b, i) => ({ ...b, rank: i + 1 }))
    )
  }

  function moveBestTrack(index: number, dir: -1 | 1) {
    setBestTracks((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((b, i) => ({ ...b, rank: i + 1 }))
    })
  }

  async function saveBestTracks() {
    setBestTracksError('')
    setBestTracksSaved(false)
    const res = await fetch('/api/best-tracks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_ids: bestTracks.map((b) => b.track_id) }),
    })
    const data = await res.json()
    if (!res.ok) { setBestTracksError(data.error); return }
    setBestTracksSaved(true)
    loadBestTracks()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)
    const tags = personaTags.split(',').map((t) => t.trim()).filter(Boolean)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, bio, persona_tags: tags }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setSaved(true)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <Link href="/home" className="font-display text-xl font-bold">RESON</Link>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ戻る
          </Link>
        </div>

        <h1 className="font-display mt-8 text-2xl font-bold">音楽人格・プロフィール</h1>
        <p className="mt-2 text-sm text-[var(--faint)]">
          自分の音楽の好みをタグで表現できます（自己申告制）。
        </p>

        {loading ? (
          <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
        ) : (
          <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div>
              <label className="text-xs text-[var(--faint)]">表示名</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--faint)]">自己紹介</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--faint)]">音楽人格タグ（カンマ区切り・最大10個）</label>
              <input
                value={personaTags}
                onChange={(e) => setPersonaTags(e.target.value)}
                placeholder="例: シティポップ, 夜更かし, ギターロック"
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--faint)] focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {saved && <p className="text-xs text-[var(--accent)]">保存しました</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
            >
              {saving ? '保存中…' : '保存する'}
            </button>
          </form>
        )}

        <h2 className="font-display mt-10 text-xl font-bold">ベストトラックランキング</h2>
        <p className="mt-2 text-sm text-[var(--faint)]">
          好きな楽曲を最大{MAX_BEST_TRACKS}曲、ランキング形式で公開できます（Topster風プロフィール）。
        </p>

        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="楽曲名で検索して追加…"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--faint)] focus:outline-none"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addBestTrack(t)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface)]"
                >
                  {t.title} <span className="text-[var(--faint)]">・ {t.artists?.name}</span>
                </button>
              ))}
            </div>
          )}

          {bestTracksError && <p className="mt-2 text-xs text-red-400">{bestTracksError}</p>}

          {bestTracks.length === 0 ? (
            <p className="mt-4 text-center text-xs text-[var(--faint)]">まだランクインした楽曲がありません</p>
          ) : (
            <div className="mt-4 space-y-2">
              {bestTracks.map((b, i) => (
                <div key={b.track_id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
                  <span className="w-6 shrink-0 text-sm font-bold text-[var(--accent)]">#{b.rank}</span>
                  <div className="flex-1 text-sm">
                    {b.tracks?.title}
                    <span className="ml-1 text-xs text-[var(--faint)]">・ {b.tracks?.artists?.name}</span>
                  </div>
                  <button onClick={() => moveBestTrack(i, -1)} disabled={i === 0} className="text-xs text-[var(--dim)] disabled:opacity-30">▲</button>
                  <button onClick={() => moveBestTrack(i, 1)} disabled={i === bestTracks.length - 1} className="text-xs text-[var(--dim)] disabled:opacity-30">▼</button>
                  <button onClick={() => removeBestTrack(b.track_id)} className="text-xs text-red-400">✕</button>
                </div>
              ))}
            </div>
          )}

          {bestTracksSaved && <p className="mt-3 text-xs text-[var(--accent)]">保存しました</p>}
          <button
            onClick={saveBestTracks}
            disabled={bestTracks.length === 0}
            className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            ランキングを保存する
          </button>
        </div>
      </div>
    </div>
  )
}
