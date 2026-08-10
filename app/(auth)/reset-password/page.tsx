'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">RESON</h1>
          <p className="mt-2 text-sm text-zinc-400">パスワードの再設定</p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-4xl">📩</p>
            <p className="text-sm text-zinc-300">
              {email} にパスワード再設定用のリンクを送信しました。メール内のリンクから再設定を完了してください。
            </p>
            <Link href="/login" className="block text-sm text-zinc-500 hover:text-zinc-300 transition">
              ログインへ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={requestReset} className="space-y-4">
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
              <p className="mt-1 text-xs text-zinc-600">登録済みのメールアドレスに再設定用のリンクを送信します</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '送信中…' : '再設定リンクを送信'}
            </button>
            <Link href="/login" className="block text-center text-sm text-zinc-500 hover:text-zinc-300 transition">
              ログインへ戻る
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
