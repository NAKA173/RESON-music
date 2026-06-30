'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [personaTags, setPersonaTags] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

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
  }, [])

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
      </div>
    </div>
  )
}
