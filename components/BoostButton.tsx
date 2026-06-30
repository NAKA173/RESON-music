'use client'

import { useEffect, useState } from 'react'

interface BoostStatus {
  used: number
  remaining: number
  free_remaining: number
  price_yen: number
}

export function BoostButton({ trackId }: { trackId: string }) {
  const [status, setStatus] = useState<BoostStatus | null>(null)
  const [boosting, setBoosting] = useState(false)
  const [error, setError] = useState('')
  const [justBoosted, setJustBoosted] = useState(false)

  useEffect(() => {
    fetch('/api/boost')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d))
  }, [])

  async function boost() {
    setError('')
    setBoosting(true)
    const res = await fetch('/api/boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId }),
    })
    const data = await res.json()
    setBoosting(false)
    if (!res.ok) { setError(data.error); return }

    if (data.type === 'free') {
      setJustBoosted(true)
      setStatus((s) => s ? { ...s, used: s.used + 1, remaining: data.remaining, free_remaining: Math.max(s.free_remaining - 1, 0) } : s)
      setTimeout(() => setJustBoosted(false), 1500)
    } else {
      // 有料分は決済確認が必要（最小実装: 今は決済UIへの導線案内のみ）
      setError(`追加ブーストは¥${data.price_yen}（決済確認は別途必要です）`)
    }
  }

  if (!status) return null

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={boost}
        disabled={boosting || status.remaining <= 0}
        title="ブーストハート（本気で推している楽曲への応援表明）"
        className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-400 disabled:opacity-40"
      >
        🚀 {justBoosted ? 'ブースト済み' : 'ブースト'}
      </button>
      <span className="text-xs text-zinc-500">
        今月残り{status.remaining}回（無料{status.free_remaining}回）
      </span>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
