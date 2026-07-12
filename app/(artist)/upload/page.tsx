'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { computeClientFingerprint } from '@/lib/audio/client-fingerprint'

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/wav', 'audio/ogg']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 200
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

  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then((d) => setGenres(d.genres ?? []))
    loadAlbums()
  }, [])

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
    setError('')
    setAlbumCoverUploading(true)
    setAlbumCoverDone(false)
    const metaRes = await fetch('/api/albums/cover-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ album_id: albumId, content_type: f.type }),
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
        title,
        duration_sec,
        ai_generated: aiGenerated,
        genre_ids: selectedGenreIds,
        album_id: albumId || undefined,
        track_number: albumId && trackNumber ? Number(trackNumber) : undefined,
        isrc: isrc || undefined,
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
        body: JSON.stringify({ track_id: meta.track_id, content_type: coverFile.type }),
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
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {aiWarning && (
          <p className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded-lg px-4 py-3">
            ⚠️ {aiWarning}
          </p>
        )}

        {duplicateWarning && (
          <p className="text-sm text-orange-400 bg-orange-900/20 border border-orange-800 rounded-lg px-4 py-3">
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
              type="file"
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
            <label className="block text-sm text-zinc-400 mb-1">タイトル <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
            />
          </div>

          {/* ISRC */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">ISRC（任意）</label>
            <input
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
            <label className="block text-sm text-zinc-400 mb-2">アルバム（任意）</label>
            <select
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
                <label className="block text-xs text-zinc-500 mb-1">アルバム内の曲順（任意）</label>
                <input
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
