'use client'

import { useState } from 'react'
import { PaymentConfirmModal } from './PaymentConfirmModal'

const TIP_PRESETS = [100, 300, 500, 1000]

export function SupportButton({ trackId }: { trackId: string }) {
  const [hearted, setHearted] = useState(false)
  const [showTipForm, setShowTipForm] = useState(false)
  const [tipAmount, setTipAmount] = useState(TIP_PRESETS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [tipSent, setTipSent] = useState(false)

  async function sendHeart() {
    setError('')
    const res = await fetch('/api/supports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      return
    }
    setHearted(true)
    setTimeout(() => setHearted(false), 1500)
  }

  async function startTip() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/supports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId, amount_yen: tipAmount }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }

    if (data.type === 'tip_deferred') {
      // Support+ は月末蓄積精算のため即時決済不要
      setTipSent(true)
      setShowTipForm(false)
      setTimeout(() => setTipSent(false), 2000)
      return
    }
    setClientSecret(data.client_secret)
  }

  function onTipSuccess() {
    setTipSent(true)
    setShowTipForm(false)
    setTimeout(() => setTipSent(false), 2000)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={sendHeart}
        title="応援する（❤️・無制限・無料）"
        className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-400"
      >
        ❤️ {hearted ? '応援しました' : '応援'}
      </button>
      <button
        onClick={() => setShowTipForm((v) => !v)}
        title="投げ銭（最低100円）"
        className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-400"
      >
        💴 {tipSent ? '送りました' : '投げ銭'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}

      {showTipForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">投げ銭する</h3>
              <button onClick={() => setShowTipForm(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTipAmount(amt)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    tipAmount === amt ? 'border-white bg-white text-black' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  ¥{amt}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={startTip}
              disabled={loading}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-40"
            >
              {loading ? '準備中…' : `¥${tipAmount} を送る`}
            </button>
          </div>
        </div>
      )}

      {clientSecret && (
        <PaymentConfirmModal
          clientSecret={clientSecret}
          title={`投げ銭（¥${tipAmount}）`}
          onSuccess={onTipSuccess}
          onClose={() => setClientSecret(null)}
        />
      )}
    </div>
  )
}
