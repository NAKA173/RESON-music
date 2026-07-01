'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ApproveContent() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function respond(action: 'approved' | 'rejected') {
    setBusy(true)
    setError('')
    const res = await fetch('/api/parental/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error); return }
    setResult(action)
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12 flex items-center justify-center">
      <div className="max-w-sm w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold">保護者による承認</h1>

        {!token ? (
          <p className="text-sm text-red-400">リンクが不正です</p>
        ) : result === 'approved' ? (
          <p className="text-sm text-emerald-400">承認しました。以後の月額決済はあなたのアカウントで行われます。</p>
        ) : result === 'rejected' ? (
          <p className="text-sm text-zinc-400">申請を却下しました。</p>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              このリンクを開いたご本人（保護者）のアカウントに、未成年のアカウントの月額決済を紐付けます。
              以後、月額プランの支払いはこのアカウントのカードで行われます。
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => respond('rejected')}
                disabled={busy}
                className="flex-1 rounded-lg border border-zinc-700 py-3 text-sm hover:border-zinc-400 disabled:opacity-50"
              >
                却下する
              </button>
              <button
                onClick={() => respond('approved')}
                disabled={busy}
                className="flex-1 rounded-lg bg-white text-black font-semibold py-3 text-sm hover:bg-zinc-200 disabled:opacity-50"
              >
                承認する
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function ParentalApprovePage() {
  return (
    <Suspense>
      <ApproveContent />
    </Suspense>
  )
}
