'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Request = {
  id: string
  user_id: string
  request_type: string
  details: string
  status: string
  response: string | null
  created_at: string
  responded_at: string | null
}

export default function AdminPrivacyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    fetch('/api/admin/privacy-requests', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? '取得できませんでした')
        setRequests(data.requests ?? [])
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '取得できませんでした'))
  }, [])

  async function update(request: Request, status: string) {
    if ((status === 'completed' || status === 'declined') && !drafts[request.id]?.trim()) {
      setError('回答または対応できない理由を入力してください')
      return
    }
    setBusyId(request.id)
    setError('')
    try {
      const response = await fetch('/api/admin/privacy-requests', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, status, response: drafts[request.id] ?? '' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? '更新できませんでした')
      setRequests((current) => current.map((item) => item.id === request.id
        ? { ...item, ...data.request } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新できませんでした')
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← 審査ダッシュボード</Link>
        <h1 className="mt-6 text-2xl font-semibold">個人データ請求の対応</h1>
        <p className="mt-3 text-sm text-zinc-400">受付から原則1か月以内に確認・回答してください。回答済みへの変更は実際の対応後に行います。</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        <div className="mt-6 space-y-4">
          {requests.length === 0 && <p className="text-sm text-zinc-500">請求はありません。</p>}
          {requests.map((request) => {
            const closed = request.status === 'completed' || request.status === 'declined'
            const deadline = new Date(request.created_at)
            deadline.setMonth(deadline.getMonth() + 1)
            return (
              <article key={request.id} className="rounded-lg border border-zinc-800 p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{request.request_type}</strong>
                  <span>{request.status}</span>
                </div>
                <p className="mt-2 break-all text-xs text-zinc-500">利用者: {request.user_id}</p>
                <p className="mt-1 text-xs text-zinc-500">受付: {new Date(request.created_at).toLocaleDateString('ja-JP')} / 目安: {deadline.toLocaleDateString('ja-JP')}</p>
                {request.details && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{request.details}</p>}
                {closed ? (
                  <p className="mt-3 whitespace-pre-wrap border-t border-zinc-800 pt-3 text-sm">回答: {request.response}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <label htmlFor={`response-${request.id}`} className="block text-sm">利用者への回答</label>
                    <textarea id={`response-${request.id}`} rows={4} maxLength={4000}
                      value={drafts[request.id] ?? request.response ?? ''}
                      onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm" />
                    <div className="flex flex-wrap gap-2">
                      {request.status === 'received' && <button disabled={busyId === request.id} onClick={() => update(request, 'in_progress')}
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">確認中にする</button>}
                      <button disabled={busyId === request.id} onClick={() => update(request, 'completed')}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">対応・回答済みにする</button>
                      <button disabled={busyId === request.id} onClick={() => update(request, 'declined')}
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">理由を付けて対応不可</button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
