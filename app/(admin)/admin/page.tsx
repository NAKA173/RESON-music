'use client'

import { useEffect, useState } from 'react'

type Tab = 'artists' | 'tracks' | 'fraud' | 'reports' | 'payouts' | 'founding'

interface PendingArtist {
  id: string
  name: string
  bio: string | null
  is_minor: boolean
  created_at: string
}

interface PendingTrack {
  id: string
  title: string
  ai_generated: boolean
  created_at: string
  artists: { id: string; name: string } | null
}

interface FraudFlag {
  id: string
  track_id: string
  user_id: string
  flag_type: string
  level: number
  created_at: string
  tracks: { id: string; title: string; fraud_suspended: boolean } | null
}

interface Report {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  created_at: string
}

interface PayoutRequest {
  id: string
  artist_id: string
  amount_yen: number
  status: string
  requested_at: string
  artists: { id: string; name: string } | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'artists', label: 'アーティスト審査' },
  { key: 'tracks', label: '楽曲審査' },
  { key: 'fraud', label: '不正検知' },
  { key: 'reports', label: '通報' },
  { key: 'payouts', label: '出金申請' },
  { key: 'founding', label: '創設アーティスト' },
]

interface ArtistSearchResult {
  id: string
  name: string
  review_status: string
  founding_artist: boolean
}

export default function AdminPage() {
  const [authState, setAuthState] = useState<'checking' | 'denied' | 'ok'>('checking')
  const [tab, setTab] = useState<Tab>('artists')

  const [artists, setArtists] = useState<PendingArtist[]>([])
  const [tracks, setTracks] = useState<PendingTrack[]>([])
  const [flags, setFlags] = useState<FraudFlag[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [foundingQuery, setFoundingQuery] = useState('')
  const [foundingResults, setFoundingResults] = useState<ArtistSearchResult[]>([])

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAuthState(d.is_admin ? 'ok' : 'denied'))
  }, [])

  useEffect(() => {
    if (authState !== 'ok') return
    loadAll()
  }, [authState])

  function loadAll() {
    fetch('/api/admin/artists').then((r) => r.json()).then((d) => setArtists(d.artists ?? []))
    fetch('/api/admin/tracks').then((r) => r.json()).then((d) => setTracks(d.tracks ?? []))
    fetch('/api/admin/fraud-flags').then((r) => r.json()).then((d) => setFlags(d.flags ?? []))
    fetch('/api/admin/reports').then((r) => r.json()).then((d) => setReports(d.reports ?? []))
    fetch('/api/admin/payouts').then((r) => r.json()).then((d) => setPayouts(d.requests ?? []))
  }

  async function reviewArtist(id: string, action: 'approved' | 'rejected') {
    await fetch('/api/admin/artists/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: id, action }),
    })
    setArtists((prev) => prev.filter((a) => a.id !== id))
  }

  async function reviewTrack(id: string, action: 'approved' | 'rejected') {
    await fetch('/api/admin/tracks/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: id, action }),
    })
    setTracks((prev) => prev.filter((t) => t.id !== id))
  }

  async function resolveFlag(id: string, unsuspend: boolean) {
    await fetch('/api/admin/fraud-flags/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, unsuspend }),
    })
    setFlags((prev) => prev.filter((f) => f.id !== id))
  }

  async function resolveReport(id: string, status: 'reviewed' | 'dismissed') {
    await fetch('/api/admin/reports/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  async function processPayout(id: string, action: 'paid' | 'rejected') {
    await fetch('/api/admin/payouts/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: id, action }),
    })
    setPayouts((prev) => prev.filter((p) => p.id !== id))
  }

  async function searchFoundingArtists() {
    if (!foundingQuery.trim()) { setFoundingResults([]); return }
    const res = await fetch(`/api/admin/artists/search?q=${encodeURIComponent(foundingQuery)}`)
    const data = await res.json()
    setFoundingResults(data.artists ?? [])
  }

  async function toggleFounding(artistId: string, next: boolean) {
    await fetch('/api/admin/artists/founding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: artistId, founding_artist: next }),
    })
    setFoundingResults((prev) => prev.map((a) => (a.id === artistId ? { ...a, founding_artist: next } : a)))
  }

  if (authState === 'checking') {
    return <main className="min-h-screen bg-black text-white flex items-center justify-center text-zinc-500">確認中…</main>
  }
  if (authState === 'denied') {
    return <main className="min-h-screen bg-black text-white flex items-center justify-center text-zinc-500">権限がありません</main>
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">審査ダッシュボード</h1>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 text-sm px-3 py-1.5 rounded-lg border transition ${
                t.key === tab ? 'border-white bg-white text-black' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {t.label}
              {t.key === 'artists' && artists.length > 0 && ` (${artists.length})`}
              {t.key === 'tracks' && tracks.length > 0 && ` (${tracks.length})`}
              {t.key === 'fraud' && flags.length > 0 && ` (${flags.length})`}
              {t.key === 'reports' && reports.length > 0 && ` (${reports.length})`}
              {t.key === 'payouts' && payouts.length > 0 && ` (${payouts.length})`}
            </button>
          ))}
        </div>

        {tab === 'artists' && (
          <div className="space-y-2">
            {artists.length === 0 ? (
              <p className="text-sm text-zinc-500">審査待ちのアーティストはいません</p>
            ) : (
              artists.map((a) => (
                <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.name}{a.is_minor && <span className="ml-2 text-xs text-yellow-500">未成年</span>}</p>
                    <p className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleDateString('ja-JP')}</p>
                  </div>
                  {a.bio && <p className="text-sm text-zinc-400">{a.bio}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => reviewArtist(a.id, 'approved')} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold">承認</button>
                    <button onClick={() => reviewArtist(a.id, 'rejected')} className="text-xs border border-red-800 text-red-400 px-3 py-1.5 rounded-lg">却下</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'tracks' && (
          <div className="space-y-2">
            {tracks.length === 0 ? (
              <p className="text-sm text-zinc-500">審査待ちの楽曲はありません</p>
            ) : (
              tracks.map((t) => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {t.title}
                      {t.ai_generated && <span className="ml-2 text-xs text-yellow-500">AI生成</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{new Date(t.created_at).toLocaleDateString('ja-JP')}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{t.artists?.name ?? '不明'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => reviewTrack(t.id, 'approved')} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold">承認</button>
                    <button onClick={() => reviewTrack(t.id, 'rejected')} className="text-xs border border-red-800 text-red-400 px-3 py-1.5 rounded-lg">却下</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'fraud' && (
          <div className="space-y-2">
            {flags.length === 0 ? (
              <p className="text-sm text-zinc-500">未解決の不正検知フラグはありません</p>
            ) : (
              flags.map((f) => (
                <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {f.flag_type}
                      <span className="ml-2 text-xs text-zinc-500">level {f.level}</span>
                      {f.tracks?.fraud_suspended && <span className="ml-2 text-xs text-red-400">配信停止中</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{new Date(f.created_at).toLocaleDateString('ja-JP')}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{f.tracks?.title ?? '不明な楽曲'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => resolveFlag(f.id, false)} className="text-xs border border-zinc-700 px-3 py-1.5 rounded-lg">
                      解決済みにする
                    </button>
                    {f.tracks?.fraud_suspended && (
                      <button onClick={() => resolveFlag(f.id, true)} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold">
                        解決して配信を再開
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-sm text-zinc-500">保留中の通報はありません</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{r.target_type}</p>
                    <p className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleDateString('ja-JP')}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{r.reason}</p>
                  <div className="flex gap-2">
                    <button onClick={() => resolveReport(r.id, 'reviewed')} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold">対応済み</button>
                    <button onClick={() => resolveReport(r.id, 'dismissed')} className="text-xs border border-zinc-700 px-3 py-1.5 rounded-lg">問題なし</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'payouts' && (
          <div className="space-y-2">
            {payouts.length === 0 ? (
              <p className="text-sm text-zinc-500">審査待ちの出金申請はありません</p>
            ) : (
              payouts.map((p) => (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{p.artists?.name ?? '不明'}</p>
                    <p className="text-sm">¥{Math.floor(p.amount_yen).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-zinc-500">{new Date(p.requested_at).toLocaleDateString('ja-JP')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => processPayout(p.id, 'paid')} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold">支払済にする</button>
                    <button onClick={() => processPayout(p.id, 'rejected')} className="text-xs border border-red-800 text-red-400 px-3 py-1.5 rounded-lg">却下</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'founding' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              アーティスト名で検索し、創設アーティストのバッジ付与/解除を行います（バッジのみ・分配重みへの反映は未実装）。
            </p>
            <div className="flex gap-2">
              <input
                value={foundingQuery}
                onChange={(e) => setFoundingQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchFoundingArtists() }}
                placeholder="アーティスト名で検索…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
              />
              <button onClick={searchFoundingArtists} className="text-xs border border-zinc-700 px-4 py-2 rounded-lg">検索</button>
            </div>
            <div className="space-y-2">
              {foundingResults.map((a) => (
                <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                  <p className="font-medium">
                    {a.name}
                    {a.founding_artist && <span className="ml-2 text-yellow-400">★ 創設アーティスト</span>}
                  </p>
                  <button
                    onClick={() => toggleFounding(a.id, !a.founding_artist)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                      a.founding_artist ? 'border border-zinc-700 text-zinc-300' : 'bg-white text-black'
                    }`}
                  >
                    {a.founding_artist ? '解除する' : 'バッジを付与'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
