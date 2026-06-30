'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Community {
  id: string
  name: string
  parent_id: string | null
  member_count: number
  joined: boolean
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    fetch('/api/communities')
      .then((r) => r.json())
      .then((d) => { setCommunities(d.communities ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function toggleJoin(c: Community) {
    setBusyId(c.id)
    await fetch('/api/communities', {
      method: c.joined ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre_id: c.id }),
    })
    setBusyId(null)
    load()
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

        <h1 className="font-display mt-8 text-2xl font-bold">ジャンル別コミュニティ</h1>
        <p className="mt-2 text-sm text-[var(--faint)]">
          好きなジャンルに参加して、専用フィードで語り合えます。
        </p>

        {loading ? (
          <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
        ) : (
          <div className="mt-6 space-y-3">
            {communities.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-[var(--faint)]">{c.member_count}人が参加中</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.joined && (
                    <Link
                      href={`/feed?genre_id=${c.id}`}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                    >
                      フィードへ
                    </Link>
                  )}
                  <button
                    onClick={() => toggleJoin(c)}
                    disabled={busyId === c.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                      c.joined
                        ? 'border border-[var(--line)] text-[var(--dim)]'
                        : 'bg-[var(--accent)] text-[var(--ink)]'
                    }`}
                  >
                    {c.joined ? '参加中' : '参加する'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
