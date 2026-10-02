'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { computeClientFingerprint } from '@/lib/audio/client-fingerprint'
import {
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABELS,
  RECORDING_TYPES,
  RECORDING_TYPE_LABELS,
  RIGHTS_STATUS_LABELS,
  RIGHTS_STATUSES,
  type ContentCategory,
  type RecordingType,
  type RightsStatus,
} from '@/lib/music/metadata'
import { TRACK_CREDIT_ROLE_LABELS, TRACK_CREDIT_ROLES, type TrackCreditRole } from '@/lib/music/credits'

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/wav', 'audio/ogg']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 200
const MAX_IMAGE_SIZE_MB = 10
const MAX_GENRES = 3

interface Genre {
  id: string
  name: string
  parent_id: string | null
}

interface Album {
  id: string
  title: string
  release_type: 'single' | 'ep' | 'album'
  cover_r2_key: string | null
}

interface CreditDraft {
  artist_id: string | null
  display_name: string
  role: TrackCreditRole
}

interface ArtistSuggestion {
  id: string
  name: string
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [aiWarning, setAiWarning] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [genres, setGenres] = useState<Genre[]>([])
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [albumId, setAlbumId] = useState('')
  const [newAlbumTitle, setNewAlbumTitle] = useState('')
  const [newAlbumReleaseType, setNewAlbumReleaseType] = useState<'single' | 'ep' | 'album'>('album')
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [trackNumber, setTrackNumber] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [albumCoverUploading, setAlbumCoverUploading] = useState(false)
  const [albumCoverDone, setAlbumCoverDone] = useState(false)
  const albumCoverInputRef = useRef<HTMLInputElement>(null)
  const [isrc, setIsrc] = useState('')
  const [recordingType, setRecordingType] = useState<RecordingType>('original')
  const [contentCategory, setContentCategory] = useState<ContentCategory>('none')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceArtistName, setSourceArtistName] = useState('')
  const [sourceWorkTitle, setSourceWorkTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [rightsStatus, setRightsStatus] = useState<RightsStatus>('original')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [rightsNote, setRightsNote] = useState('')
  const [credits, setCredits] = useState<CreditDraft[]>([])
  const [creditName, setCreditName] = useState('')
  const [creditRole, setCreditRole] = useState<TrackCreditRole>('featured_artist')
  const [creditArtistId, setCreditArtistId] = useState<string | null>(null)
  const [creditSearch, setCreditSearch] = useState('')
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistSuggestion[]>([])

  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then((d) => setGenres(d.genres ?? []))
    loadAlbums()
  }, [])

  useEffect(() => {
    const query = creditSearch.trim()
    if (query.length < 2) {
      setArtistSuggestions([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/artists/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { artists: [] }))
        .then((d) => setArtistSuggestions(d.artists ?? []))
    }, 250)
    return () => clearTimeout(timer)
  }, [creditSearch])

  function loadAlbums() {
    fetch('/api/albums?mine=true')
      .then((r) => r.json())
      .then((d) => setAlbums(d.albums ?? []))
  }

  async function createAlbum() {
    if (!newAlbumTitle.trim()) return
    setCreatingAlbum(true)
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newAlbumTitle, release_type: newAlbumReleaseType }),
    })
    const data = await res.json()
    setCreatingAlbum(false)
    if (!res.ok) { setError(data.error); return }
    setNewAlbumTitle('')
    loadAlbums()
    setAlbumId(data.album.id)
    setCoverFile(null)
  }

  function toggleGenre(id: string) {
    setSelectedGenreIds((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id)
      if (prev.length >= MAX_GENRES) return prev
      return [...prev, id]
    })
  }

  function changeRecordingType(next: RecordingType) {
    setRecordingType(next)
    if (next === 'original') {
      setRightsStatus('original')
    } else if (rightsStatus === 'original') {
      setRightsStatus('permission_obtained')
    }
  }

  function selectCreditArtist(artist: ArtistSuggestion) {
    setCreditName(artist.name)
    setCreditArtistId(artist.id)
    setCreditSearch('')
    setArtistSuggestions([])
  }

  function addCredit() {
    const displayName = creditName.trim()
    if (!displayName || credits.length >= 20) return
    setCredits((prev) => [...prev, { artist_id: creditArtistId, display_name: displayName, role: creditRole }])
    setCreditName('')
    setCreditArtistId(null)
    setCreditSearch('')
  }

  const macroGenres = genres.filter((g) => !g.parent_id)
  const subGenres = genres.filter((g) => g.parent_id)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('対応形式: MP3 / M4A / FLAC / WAV / OGG')
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${MAX_SIZE_MB}MB以内にしてください`)
      return
    }
    setError('')
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function onAlbumCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !albumId) return
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
      setError('ジャケット画像はJPEG/PNG/WebP形式のみ対応しています')
      return
    }
    if (f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setError(`ジャケット画像は${MAX_IMAGE_SIZE_MB}MB以内にしてください`)
      return
    }
    setError('')
    setAlbumCoverUploading(true)
    setAlbumCoverDone(false)
    const metaRes = await fetch('/api/albums/cover-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ album_id: albumId, content_type: f.type, content_length: f.size }),
    })
    const meta = await metaRes.json()
    if (!metaRes.ok) {
      setAlbumCoverUploading(false)
      setError(meta.error)
      return
    }
    await fetch(meta.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': f.type },
      body: f,
    })
    setAlbumCoverUploading(false)
    setAlbumCoverDone(true)
    loadAlbums()
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
      setError('ジャケット画像はJPEG/PNG/WebP形式のみ対応しています')
      return
    }
    if (f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setError(`ジャケット画像は${MAX_IMAGE_SIZE_MB}MB以内にしてください`)
      return
    }
    setError('')
    setCoverFile(f)
  }

  async function getDuration(f: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.src = URL.createObjectURL(f)
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(audio.src)
        resolve(Math.ceil(audio.duration))
      })
      audio.addEventListener('error', () => resolve(0))
    })
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    if (!rightsConfirmed) {
      setError('権利確認のチェックが必要です')
      return
    }
    setLoading(true)
    setProgress(0)

    const duration_sec = await getDuration(file)
    if (duration_sec < 1) {
      setError('楽曲の長さを読み取れませんでした')
      setLoading(false)
      return
    }

    // Step 1: 署名付きURL取得 + tracks レコード作成
    const metaRes = await fetch('/api/tracks/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_type: file.type,
        content_length: file.size,
        title,
        duration_sec,
        ai_generated: aiGenerated,
        genre_ids: selectedGenreIds,
        album_id: albumId || undefined,
        track_number: albumId && trackNumber ? Number(trackNumber) : undefined,
        isrc: isrc || undefined,
        credits,
        recording_type: recordingType,
        content_category: contentCategory,
        source_title: sourceTitle,
        source_artist_name: sourceArtistName,
        source_work_title: sourceWorkTitle,
        source_url: sourceUrl,
        rights_status: rightsStatus,
        rights_confirmed: rightsConfirmed,
        rights_note: rightsNote,
      }),
    })
    const meta = await metaRes.json()
    if (!metaRes.ok) {
      setError(meta.error)
      setLoading(false)
      return
    }

    setProgress(10)
    setStatusMsg('ファイルをアップロード中…')

    // Step 2: R2 に直接 PUT（署名付きURL経由）
    const putRes = await fetch(meta.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!putRes.ok) {
      setError('ファイルのアップロードに失敗しました')
      setLoading(false)
      return
    }

    setProgress(50)

    // ジャケット画像（任意・アルバムに紐付けた場合はアルバム側のジャケットを使うため送らない）
    if (coverFile && !albumId) {
      setStatusMsg('ジャケット画像をアップロード中…')
      const coverMetaRes = await fetch('/api/tracks/cover-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: meta.track_id, content_type: coverFile.type, content_length: coverFile.size }),
      })
      const coverMeta = await coverMetaRes.json()
      if (coverMetaRes.ok) {
        await fetch(coverMeta.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type },
          body: coverFile,
        })
      }
    }

    setProgress(60)
    setStatusMsg('重複チェック中…')

    // Step 3: AI生成チェック（メタデータパターン検出）
    const aiRes = await fetch('/api/tracks/ai-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: meta.track_id, self_declared: aiGenerated }),
    })
    const aiData = await aiRes.json()
    if (aiData.ai_generated && aiData.reason === 'metadata_pattern') {
      setAiWarning(aiData.message)
    }

    setProgress(80)
    setStatusMsg('重複楽曲を確認中…')

    // Step 4: フィンガープリント生成・送信（重複検知）
    // 簡易実装（真のChromaprint互換ではない・詳細はlib/audio/client-fingerprint.tsを参照）
    let duplicateDetected = false
    const fingerprint = await computeClientFingerprint(file)
    if (fingerprint) {
      const fpRes = await fetch('/api/tracks/fingerprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: meta.track_id, fingerprint, duration_sec }),
      })
      if (fpRes.status === 409) {
        const fpData = await fpRes.json()
        duplicateDetected = true
        setDuplicateWarning(
          `この楽曲は既存の楽曲と非常に似ています（重複の可能性）。審査時に確認されます。track_id: ${fpData.existing_track_id ?? '不明'}`
        )
      }
    }

    setProgress(100)
    setStatusMsg('')
    setLoading(false)

    if (duplicateDetected) {
      // 重複の可能性がある場合は警告を読んでもらうため遷移を遅らせる
      setTimeout(() => router.push('/dashboard'), 4000)
    } else if (!aiData.ai_generated || aiData.reason === 'self_declared') {
      router.push('/dashboard')
    }
    // AI検出された場合は確認ダイアログを表示してから遷移
    if (!duplicateDetected && aiData.ai_generated && aiData.reason === 'metadata_pattern') {
      setTimeout(() => router.push('/dashboard'), 3000)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">楽曲をアップロード</h1>
          <p className="text-sm text-zinc-400 mt-1">MP3 / M4A / FLAC / WAV / OGG（最大{MAX_SIZE_MB}MB）</p>
          <p className="text-xs text-zinc-600 mt-1">
            アップロード後、審査（著作権侵害・不正コンテンツの確認）を経て配信開始となります。審査中もダッシュボードから確認できます。
          </p>
        </div>

        {error && (
          <p role="alert" aria-live="assertive" className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {aiWarning && (
          <p role="status" aria-live="polite" className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded-lg px-4 py-3">
            ⚠️ {aiWarning}
          </p>
        )}

        {duplicateWarning && (
          <p role="status" aria-live="polite" className="text-sm text-orange-400 bg-orange-900/20 border border-orange-800 rounded-lg px-4 py-3">
            ⚠️ {duplicateWarning}
          </p>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          {/* ファイル選択 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
              file ? 'border-zinc-500 bg-zinc-900' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <input
              ref={fileInputRef}
              id="track-audio-file"
              type="file"
              aria-label="楽曲ファイル"
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={onFileChange}
            />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-zinc-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-3">🎵</p>
                <p className="text-zinc-400">クリックしてファイルを選択</p>
              </div>
            )}
          </div>

          {/* タイトル */}
          <div>
            <label htmlFor="track-title" className="block text-sm text-zinc-400 mb-1">タイトル <span className="text-red-400">*</span></label>
            <input
              id="track-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
            />
          </div>

          {/* 作品・クレジット情報 */}
          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div>
              <h2 className="text-sm font-semibold">作品・クレジット情報</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                feat. や原曲情報をタイトルへ直接書かず、検索・表示できるクレジットとして登録します。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="recording-type" className="block text-xs text-zinc-400 mb-1">楽曲の種類</label>
                <select
                  id="recording-type"
                  value={recordingType}
                  onChange={(e) => changeRecordingType(e.target.value as RecordingType)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-400"
                >
                  {RECORDING_TYPES.map((type) => <option key={type} value={type}>{RECORDING_TYPE_LABELS[type]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="content-category" className="block text-xs text-zinc-400 mb-1">関連コンテンツ</label>
                <select
                  id="content-category"
                  value={contentCategory}
                  onChange={(e) => setContentCategory(e.target.value as ContentCategory)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-400"
                >
                  {CONTENT_CATEGORIES.map((category) => <option key={category} value={category}>{CONTENT_CATEGORY_LABELS[category]}</option>)}
                </select>
              </div>
            </div>

            {(recordingType !== 'original' || contentCategory !== 'none') && (
              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                {recordingType !== 'original' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="source-title" className="block text-xs text-zinc-400 mb-1">
                        原曲・元作品名 {['cover', 'remix', 'arrangement', 'medley'].includes(recordingType) && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        id="source-title"
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        maxLength={200}
                        required={['cover', 'remix', 'arrangement', 'medley'].includes(recordingType)}
                        placeholder="例：楽曲名／原作タイトル"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="source-artist-name" className="block text-xs text-zinc-400 mb-1">原アーティスト名（任意）</label>
                      <input
                        id="source-artist-name"
                        value={sourceArtistName}
                        onChange={(e) => setSourceArtistName(e.target.value)}
                        maxLength={200}
                        placeholder="例：原曲の作家・歌唱者"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                )}
                {contentCategory !== 'none' && (
                  <div>
                    <label htmlFor="source-work-title" className="block text-xs text-zinc-400 mb-1">作品・コンテンツ名 <span className="text-red-400">*</span></label>
                    <input
                      id="source-work-title"
                      value={sourceWorkTitle}
                      onChange={(e) => setSourceWorkTitle(e.target.value)}
                      maxLength={200}
                      required
                      placeholder="例：作品名／ゲームタイトル／配信者名"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                )}
                {recordingType !== 'original' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="rights-status" className="block text-xs text-zinc-400 mb-1">権利状態</label>
                      <select
                        id="rights-status"
                        value={rightsStatus}
                        onChange={(e) => setRightsStatus(e.target.value as RightsStatus)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-400"
                      >
                        {RIGHTS_STATUSES.filter((status) => status !== 'original').map((status) => <option key={status} value={status}>{RIGHTS_STATUS_LABELS[status]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="source-url" className="block text-xs text-zinc-400 mb-1">参照URL（任意）</label>
                      <input
                        id="source-url"
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        maxLength={500}
                        placeholder="https://…"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-white"
                  />
                  <span className="text-xs leading-5 text-zinc-400">
                    この音源を配信するために必要な権利・許諾を確認済みです。RESONは権利許諾を代行しません。
                  </span>
                </label>
                <textarea
                  aria-label="権利確認メモ"
                  value={rightsNote}
                  onChange={(e) => setRightsNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  placeholder="運営審査向けの補足（任意）"
                  className="w-full resize-none bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                />
              </div>
            )}

            {recordingType === 'original' && (
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-white"
                />
                <span className="text-xs leading-5 text-zinc-400">自分または所属先が、この音源を配信するために必要な権利を保有していることを確認しました。</span>
              </label>
            )}

            <div className="border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-300">参加者クレジット</h3>
                  <p className="mt-1 text-[11px] text-zinc-600">feat.、ボーカル、作曲、イラストなどを登録できます。</p>
                </div>
                <span className="text-[11px] text-zinc-600">{credits.length}/20</span>
              </div>
              {credits.length > 0 && (
                <div className="mt-3 space-y-2">
                  {credits.map((credit, index) => (
                    <div key={`${credit.display_name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
                      <span className="min-w-0 truncate"><span className="text-zinc-500">{TRACK_CREDIT_ROLE_LABELS[credit.role]}</span>　{credit.display_name}</span>
                      <button type="button" onClick={() => setCredits((prev) => prev.filter((_, i) => i !== index))} className="shrink-0 text-zinc-500 underline hover:text-white">削除</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                <select
                  aria-label="クレジットの役割"
                  value={creditRole}
                  onChange={(e) => setCreditRole(e.target.value as TrackCreditRole)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-400"
                >
                  {TRACK_CREDIT_ROLES.map((role) => <option key={role} value={role}>{TRACK_CREDIT_ROLE_LABELS[role]}</option>)}
                </select>
                <div className="relative">
                  <input
                    aria-label="クレジット表示名"
                    value={creditName}
                    onChange={(e) => { setCreditName(e.target.value); setCreditArtistId(null); setCreditSearch(e.target.value) }}
                    maxLength={100}
                    placeholder="表示名（未登録の名前も可）"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                  />
                  {artistSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                      {artistSuggestions.map((artist) => (
                        <button key={artist.id} type="button" onClick={() => selectCreditArtist(artist)} className="block w-full px-3 py-2 text-left text-xs hover:bg-zinc-800">
                          {artist.name}<span className="ml-2 text-zinc-600">RESONアーティスト</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={addCredit} disabled={!creditName.trim() || credits.length >= 20} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-400 disabled:opacity-40">追加</button>
              </div>
            </div>
          </section>

          {/* ISRC */}
          <div>
            <label htmlFor="track-isrc" className="block text-sm text-zinc-400 mb-1">ISRC（任意）</label>
            <input
              id="track-isrc"
              type="text"
              value={isrc}
              onChange={(e) => setIsrc(e.target.value)}
              placeholder="例: US-RC1-76-07839"
              maxLength={15}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
            />
            <p className="mt-1 text-xs text-zinc-600">
              既に取得済みのISRCがある場合のみ入力してください。未取得の場合は空欄でかまいません。
            </p>
          </div>

          {/* ジャンルタグ（最大{MAX_GENRES}個） */}
          {genres.length > 0 && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                ジャンルタグ（最大{MAX_GENRES}個）
              </label>
              <div className="flex flex-wrap gap-2">
                {[...macroGenres, ...subGenres].map((g) => {
                  const selected = selectedGenreIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.id)}
                      className={`text-xs rounded-full border px-3 py-1.5 transition ${
                        selected
                          ? 'border-white bg-white text-black'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* アルバム */}
          <div>
            <label htmlFor="track-album" className="block text-sm text-zinc-400 mb-2">アルバム（任意）</label>
            <select
              id="track-album"
              value={albumId}
              onChange={(e) => {
                setAlbumId(e.target.value)
                if (e.target.value) setCoverFile(null)
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
            >
              <option value="">アルバムなし（シングル）</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}（{a.release_type === 'single' ? 'シングル' : a.release_type === 'ep' ? 'EP' : 'アルバム'}）
                </option>
              ))}
            </select>
            {albumId && (
              <div className="mt-2">
                <label htmlFor="track-number" className="block text-xs text-zinc-500 mb-1">アルバム内の曲順（任意）</label>
                <input
                  id="track-number"
                  type="number"
                  min={1}
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  placeholder="例: 1"
                  className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                />
              </div>
            )}
            {albumId && (
              <div className="mt-3">
                <label className="block text-xs text-zinc-500 mb-1">アルバムジャケット（任意）</label>
                <div
                  onClick={() => albumCoverInputRef.current?.click()}
                  className="border border-dashed border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:border-zinc-500 cursor-pointer transition"
                >
                  <input
                    ref={albumCoverInputRef}
                    type="file"
                    aria-label="アルバムジャケット画像"
                    accept={ALLOWED_IMAGE_TYPES.join(',')}
                    className="hidden"
                    onChange={onAlbumCoverChange}
                  />
                  {albumCoverUploading
                    ? 'アップロード中…'
                    : albumCoverDone
                      ? 'ジャケットを更新しました（クリックで再度変更）'
                      : albums.find((a) => a.id === albumId)?.cover_r2_key
                        ? '設定済み（クリックで変更）'
                        : 'クリックしてアルバムのジャケット画像を設定'}
                </div>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                maxLength={200}
                placeholder="新しいアルバム名"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              <select
                aria-label="新しいアルバムのリリース種別"
                value={newAlbumReleaseType}
                onChange={(e) => setNewAlbumReleaseType(e.target.value as 'single' | 'ep' | 'album')}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-zinc-400"
              >
                <option value="single">シングル</option>
                <option value="ep">EP</option>
                <option value="album">アルバム</option>
              </select>
              <button
                type="button"
                onClick={createAlbum}
                disabled={creatingAlbum || !newAlbumTitle.trim()}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-400 disabled:opacity-40"
              >
                {creatingAlbum ? '作成中…' : '作成'}
              </button>
            </div>
          </div>

          {/* ジャケット画像（アルバムに紐付ける場合はアルバム側のジャケットが使われるため、
              単独曲＝シングルとしてアップロードする場合のみ表示する） */}
          {!albumId && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">ジャケット画像（任意）</label>
              <div
                onClick={() => coverInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  coverFile ? 'border-zinc-500 bg-zinc-900' : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <input
                  ref={coverInputRef}
                  type="file"
                  aria-label="楽曲ジャケット画像"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={onCoverChange}
                />
                {coverFile ? (
                  <p className="text-sm text-zinc-300">{coverFile.name}</p>
                ) : (
                  <p className="text-sm text-zinc-500">クリックして画像を選択（JPEG/PNG/WebP）</p>
                )}
              </div>
            </div>
          )}

          {/* AI生成フラグ */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiGenerated}
              onChange={(e) => setAiGenerated(e.target.checked)}
              className="w-5 h-5 rounded accent-white"
            />
            <div>
              <p className="text-sm font-medium">AI生成楽曲</p>
              <p className="text-xs text-zinc-500">AIが主体的に生成した楽曲は分配重みが 0.1 になります</p>
            </div>
          </label>

          {/* プログレスバー */}
          {progress !== null && (
            <div className="space-y-1.5">
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {statusMsg && <p className="text-xs text-zinc-500">{statusMsg}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || !title || loading}
            className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
          >
            {loading ? 'アップロード中…' : 'アップロード'}
          </button>
        </form>
      </div>
    </main>
  )
}
