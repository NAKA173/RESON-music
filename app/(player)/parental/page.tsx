'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ParentalPage() {
  const [linked, setLinked] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/parental/status')
      .then((r) => r.json())
      .then((d) => {
        setLinked(Boolean(d.linked))
        setToken(d.pending_token ?? null)
        setLoading(false)
      })
  }, [])

  async function createRequest() {
    setCreating(true)
    const res = await fetch('/api/parental/request', { method: 'POST' })
    const data = await res.json()
    setCreating(false)
    if (res.ok) setToken(data.token)
  }

  const approveUrl = token && typeof window !== 'undefined'
    ? `${window.location.origin}/parental/approve?token=${token}`
    : ''

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ペアレンタル決済</h1>
          <p className="text-sm text-zinc-400 mt-1">
            未成年の方は、保護者のアカウントに決済（月額プラン）を紐付けることができます。
            プランはあなたのアカウントに付与され、支払いのみ保護者のカードで行われます。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : linked ? (
          <div className="border border-zinc-800 rounded-2xl p-6 text-sm text-emerald-400">
            保護者のアカウントに紐付けが完了しています。
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-2xl p-6 space-y-4">
            {token ? (
              <>
                <p className="text-sm text-zinc-400">
                  以下のリンクを保護者に共有し、保護者のアカウントでログインした状態で開いてもらってください。
                </p>
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs break-all text-zinc-300">
                  {approveUrl}
                </div>
              </>
            ) : (
              <button
                onClick={createRequest}
                disabled={creating}
                className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
              >
                {creating ? '作成中…' : '保護者への承認リンクを作成'}
              </button>
            )}
          </div>
        )}

        <Link href="/pricing" className="block text-center text-sm text-zinc-500 hover:text-zinc-300 underline">
          料金プランへ戻る
        </Link>
      </div>
    </main>
  )
}
