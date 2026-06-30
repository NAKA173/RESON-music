'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface EventItem {
  id: string
  artist_id: string
  title: string
  description: string | null
  event_at: string
  location: string | null
  ticket_url: string | null
  artists: { id: string; name: string } | null
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<Record<string, 'interested' | 'going'>>({})

  function load() {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => { setEvents(d.events ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function attend(eventId: string, status: 'interested' | 'going') {
    const next = statuses[eventId] === status ? null : status
    if (!next) {
      await fetch(`/api/events/${eventId}/attend`, { method: 'DELETE' })
      setStatuses((prev) => {
        const copy = { ...prev }
        delete copy[eventId]
        return copy
      })
      return
    }
    await fetch(`/api/events/${eventId}/attend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setStatuses((prev) => ({ ...prev, [eventId]: next }))
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

        <h1 className="font-display mt-8 text-2xl font-bold">ライブ情報</h1>
        <p className="mt-2 text-sm text-[var(--faint)]">
          アーティストの今後のライブ・イベント情報です。
        </p>

        {loading ? (
          <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
        ) : events.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--panel)] py-16 text-center text-[var(--faint)]">
            <p>予定されているイベントはありません</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="text-xs text-[var(--faint)]">{ev.artists?.name ?? 'アーティスト'}</p>
                <p className="mt-1 text-sm font-semibold">{ev.title}</p>
                <p className="mt-1 text-xs text-[var(--dim)]">
                  {new Date(ev.event_at).toLocaleString('ja-JP')}
                  {ev.location ? ` ・ ${ev.location}` : ''}
                </p>
                {ev.description && <p className="mt-2 whitespace-pre-wrap text-sm">{ev.description}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => attend(ev.id, 'interested')}
                    className={`rounded-lg px-3 py-1.5 text-xs ${
                      statuses[ev.id] === 'interested'
                        ? 'bg-[var(--accent)] text-[var(--ink)]'
                        : 'border border-[var(--line)] text-[var(--dim)]'
                    }`}
                  >
                    気になる
                  </button>
                  <button
                    onClick={() => attend(ev.id, 'going')}
                    className={`rounded-lg px-3 py-1.5 text-xs ${
                      statuses[ev.id] === 'going'
                        ? 'bg-[var(--accent)] text-[var(--ink)]'
                        : 'border border-[var(--line)] text-[var(--dim)]'
                    }`}
                  >
                    参加する
                  </button>
                  {ev.ticket_url && (
                    <a
                      href={ev.ticket_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                    >
                      チケット
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
