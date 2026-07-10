'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  actor_user_id: string | null
  target_type: string | null
  target_id: string | null
  read_at: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  follow: 'フォローされました',
  like: 'いいねされました',
  comment: 'コメントされました',
  mention: 'メンションされました',
  support: '応援されました',
  new_track: 'フォロー中のアーティストが新曲を配信開始しました',
  balance_threshold: '残高が一定額を超えました',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? [])
        setLoading(false)
        fetch('/api/notifications', { method: 'PATCH' })
      })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">通知</h1>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--faint)]">読み込み中…</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-[var(--faint)] text-center py-8">通知はありません</p>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 rounded-xl text-sm ${n.read_at ? 'text-[var(--dim)]' : 'text-[var(--text)] bg-[var(--surface)]'}`}
              >
                <p>{TYPE_LABEL[n.type] ?? n.type}</p>
                <p className="mt-1 text-xs text-[var(--faint)]">
                  {new Date(n.created_at).toLocaleString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
