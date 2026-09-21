'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const TYPES = [
  { id: 'access', label: '保有データの開示' },
  { id: 'portability', label: 'データの移転用コピー' },
  { id: 'erasure', label: 'データ・アカウントの削除' },
  { id: 'rectification', label: 'データの訂正' },
  { id: 'restriction', label: '処理の制限' },
  { id: 'objection', label: '処理への異議' },
] as const

type PrivacyRequest = {
  id: string
  request_type: string
  details: string
  status: string
  response: string | null
  created_at: string
  responded_at: string | null
}

const STATUS: Record<string, string> = {
  received: '受付済み', in_progress: '確認中', completed: '回答済み', declined: '対応できない理由を回答済み',
}

export default function PrivacyRequestsPage() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([])
  const [type, setType] = useState<string>('access')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/privacy/requests', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '取得に失敗しました')
        setRequests(data.requests ?? [])
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '取得に失敗しました'))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/privacy/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: type, details }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '送信できませんでした')
      setRequests((current) => [data.request, ...current])
      setDetails('')
      setMessage('請求を受け付けました。担当者が内容を確認します。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '送信できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-[680px]">
        <Link href="/settings" className="text-sm text-zinc-400 hover:text-white">← 設定に戻る</Link>
        <h1 className="mt-6 text-2xl font-semibold">個人データに関する請求</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          開示、移転用コピー、削除、訂正、処理の制限・異議をここから請求できます。
          請求は自動実行されません。本人確認、他者の権利や法令上の保存義務を確認して回答します。
          原則として受け付けから1か月以内に回答します。
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4 border-t border-zinc-800 pt-6">
          <label className="block text-sm" htmlFor="privacy-request-type">請求の種類</label>
          <select id="privacy-request-type" value={type} onChange={(event) => setType(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-white">
            {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <label className="block text-sm" htmlFor="privacy-request-details">詳細・対象データ（任意）</label>
          <textarea id="privacy-request-details" value={details} maxLength={2000}
            aria-describedby="privacy-request-details-help privacy-request-details-count"
            onChange={(event) => setDetails(event.target.value)} rows={5}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-white" />
          <div className="flex items-start justify-between gap-3 text-xs text-zinc-500">
            <p id="privacy-request-details-help">パスワードや決済カード番号は入力しないでください。</p>
            <p id="privacy-request-details-count" aria-live="polite" className="shrink-0">{details.length}/2000</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="text-sm text-green-400">{message}</p>}
          <button type="submit" disabled={busy}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? '送信中…' : '請求を送信する'}
          </button>
        </form>
        <section className="mt-10 border-t border-zinc-800 pt-6" aria-label="過去の請求">
          <h2 className="text-lg font-medium">請求の履歴</h2>
          {requests.length === 0 && <p className="mt-4 text-sm text-zinc-500">請求はまだありません。</p>}
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-lg border border-zinc-800 p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{TYPES.find((item) => item.id === request.request_type)?.label ?? request.request_type}</strong>
                  <span>{STATUS[request.status] ?? request.status}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{new Date(request.created_at).toLocaleDateString('ja-JP')} 受付</p>
                {request.details && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-400">{request.details}</p>}
                {request.response && <p className="mt-3 whitespace-pre-wrap border-t border-zinc-800 pt-3 text-sm">{request.response}</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
