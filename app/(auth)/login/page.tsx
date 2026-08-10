'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
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
      body: JSON.stringify({ email }),
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
      body: JSON.stringify({ email, token: otp, ref }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    sessionStorage.removeItem('reson_ref')
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">RESON</h1>
          <p className="mt-2 text-sm text-zinc-400">ログイン</p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {step === 'email' && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">メールアドレス</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '送信中…' : '認証コードを送信'}
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
              <p className="mt-1 text-xs text-zinc-600">{email} に送信した6桁のコード</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '確認中…' : 'ログイン'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              メールアドレスを変更する
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500">
          アカウントをお持ちでない方は{' '}
          <Link href="/register" className="text-white hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </main>
  )
}
