'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Conversation {
  user_id: string
  display_name: string | null
  last_body: string
  last_at: string
  unread: boolean
}

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

interface UserResult {
  user_id: string
  display_name: string | null
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const withUserId = searchParams.get('with')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (!withUserId) return
    loadThread(withUserId)
  }, [withUserId])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.users ?? []))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function loadConversations() {
    fetch('/api/messages/conversations')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
  }

  function loadThread(partnerId: string) {
    fetch(`/api/messages?with=${partnerId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? [])
        if (d.messages?.length > 0) {
          const first = d.messages[0]
          setMeId(first.sender_id === partnerId ? first.recipient_id : first.sender_id)
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
  }

  async function send() {
    if (!withUserId || !draft.trim()) return
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: withUserId, body: draft }),
    })
    const data = await res.json()
    if (res.ok) {
      setMeId(data.message.sender_id)
      setDraft('')
      loadThread(withUserId)
      loadConversations()
    }
  }

  function openConversation(id: string) {
    router.push(`/messages?with=${id}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold">メッセージ</h1>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          {/* 会話一覧 */}
          <div className="space-y-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ユーザーを検索して開始…"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--faint)] focus:outline-none"
            />
            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => { setSearchQuery(''); setSearchResults([]); openConversation(u.user_id) }}
                    className="block w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface)]"
                  >
                    {u.display_name ?? '名無しのユーザー'}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => openConversation(c.user_id)}
                  className={`block w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                    withUserId === c.user_id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--panel)]'
                  }`}
                >
                  <p className={c.unread ? 'font-semibold' : ''}>{c.display_name ?? '名無しのユーザー'}</p>
                  <p className="truncate text-xs text-[var(--faint)]">{c.last_body}</p>
                </button>
              ))}
            </div>
          </div>

          {/* スレッド */}
          <div>
            {!withUserId ? (
              <p className="text-sm text-[var(--faint)] text-center py-12">会話を選択してください</p>
            ) : (
              <div className="flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        m.sender_id === meId
                          ? 'ml-auto bg-[var(--accent)] text-[var(--ink)]'
                          : 'bg-[var(--panel)] border border-[var(--line)]'
                      }`}
                    >
                      {m.body}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                    maxLength={1000}
                    placeholder="メッセージを入力…"
                    className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--faint)] focus:outline-none"
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim()}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
                  >
                    送信
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  )
}
