'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp' | 'artist'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) sessionStorage.setItem('reson_ref', ref)
  }, [])

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setStep('otp')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ref = sessionStorage.getItem('reson_ref')
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, token: otp, ref }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    sessionStorage.removeItem('reson_ref')
    setStep('artist')
  }

  async function registerArtist(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/register-artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">RESON</h1>
          <p className="mt-2 text-sm text-zinc-400">アーティスト登録</p>
        </div>

        <StepIndicator current={step} />

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {step === 'phone' && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">電話番号</label>
              <input
                type="tel"
                placeholder="+819012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              <p className="mt-1 text-xs text-zinc-600">国際番号形式（+81から始まる）で入力してください</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '送信中…' : 'SMSを送信'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">認証コード</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-center text-2xl tracking-widest"
              />
              <p className="mt-1 text-xs text-zinc-600">{phone} に送信した6桁のコード</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '確認中…' : '認証する'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              電話番号を変更する
            </button>
          </form>
        )}

        {step === 'artist' && (
          <form onSubmit={registerArtist} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">アーティスト名 <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="あなたの名前・グループ名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">自己紹介（任意）</label>
              <textarea
                placeholder="どんな音楽を作っているか、活動拠点など"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 resize-none"
              />
              <p className="mt-1 text-xs text-zinc-600 text-right">{bio.length}/500</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '登録中…' : '登録する'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'phone', label: '電話番号' },
    { key: 'otp', label: 'SMS認証' },
    { key: 'artist', label: 'プロフィール' },
  ]
  const idx = steps.findIndex((s) => s.key === current)

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i <= idx ? 'text-white' : 'text-zinc-600'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < idx ? 'bg-white text-black' : i === idx ? 'border-2 border-white' : 'border border-zinc-700'}`}>
              {i < idx ? '✓' : i + 1}
            </span>
            <span className="text-xs hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px ${i < idx ? 'bg-white' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
