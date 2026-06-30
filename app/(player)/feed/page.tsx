'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string
  body: string
  visibility: string
  created_at: string
  track_id: string | null
  author_user_id: string
  author_artist_id: string | null
  tracks: { id: string; title: string } | null
  artists: { id: string; name: string } | null
}

interface Comment {
  id: string
  body: string
  user_id: string
  created_at: string
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())

  function loadFeed() {
    fetch('/api/posts')
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts ?? []); setLoading(false) })
  }

  useEffect(() => { loadFeed() }, [])

  async function submitPost(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setError('')
    setPosting(true)
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    const data = await res.json()
    setPosting(false)
    if (!res.ok) { setError(data.error); return }
    setBody('')
    loadFeed()
  }

  async function toggleLike(postId: string) {
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: 'post', target_id: postId }),
    })
    if (!res.ok) return
    const data = await res.json()
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (data.liked) next.add(postId)
      else next.delete(postId)
      return next
    })
  }

  async function openPostComments(postId: string) {
    if (openComments === postId) {
      setOpenComments(null)
      return
    }
    setOpenComments(postId)
    const res = await fetch(`/api/posts/${postId}/comments`)
    const data = await res.json()
    setComments(data.comments ?? [])
  }

  async function submitComment(postId: string) {
    if (!commentBody.trim()) return
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    })
    if (!res.ok) return
    setCommentBody('')
    const res2 = await fetch(`/api/posts/${postId}/comments`)
    const data = await res2.json()
    setComments(data.comments ?? [])
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

        <h1 className="font-display mt-8 text-2xl font-bold">フィード</h1>
        <p className="mt-2 text-sm text-[var(--faint)]">
          好きになる → 語る → つながる → 支える。リスナー・アーティストの投稿が並びます。
        </p>

        <form onSubmit={submitPost} className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="いま聴いている音楽について語る…"
            className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--faint)] focus:outline-none"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
            >
              {posting ? '投稿中…' : '投稿する'}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
        ) : posts.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--panel)] py-16 text-center text-[var(--faint)]">
            <p>まだ投稿がありません</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="text-xs text-[var(--faint)]">
                  {p.artists?.name ?? 'リスナー'} ・ {new Date(p.created_at).toLocaleDateString('ja-JP')}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
                {p.tracks && (
                  <p className="mt-2 text-xs text-[var(--accent)]">♪ {p.tracks.title}</p>
                )}
                <div className="mt-3 flex gap-4 text-xs text-[var(--dim)]">
                  <button onClick={() => toggleLike(p.id)} className="hover:text-[var(--text)]">
                    {likedIds.has(p.id) ? '❤️ いいね済み' : '🤍 いいね'}
                  </button>
                  <button onClick={() => openPostComments(p.id)} className="hover:text-[var(--text)]">
                    💬 コメント
                  </button>
                </div>

                {openComments === p.id && (
                  <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
                    {comments.map((c) => (
                      <p key={c.id} className="text-xs text-[var(--dim)]">{c.body}</p>
                    ))}
                    <div className="flex gap-2">
                      <input
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        maxLength={500}
                        placeholder="コメントする…"
                        className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs placeholder-[var(--faint)] focus:outline-none"
                      />
                      <button
                        onClick={() => submitComment(p.id)}
                        className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                      >
                        送信
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
