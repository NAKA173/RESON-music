'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ReferralData {
  referral_code: string | null
  invited_count: number
  invited_at: string[]
}

export default function InvitePage() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/referral/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false) })
  }, [])

  const inviteLink = data?.referral_code ? `${origin}/login?ref=${data.referral_code}` : ''

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <Link href="/home" className="font-display text-xl font-bold">
            RESON
          </Link>
          <Link href="/home" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
            ホームへ戻る
          </Link>
        </div>

        <h1 className="font-display mt-8 text-2xl font-bold">友人を招待する</h1>
        <p className="mt-2 text-sm text-[var(--faint)]">
          リスナーでもアーティストでも、あなたのリンクから登録した友人が記録されます。
          特典はまだありません — RESONのネットワークを広げる目的のシンプルな紹介機能です。
        </p>

        {loading ? (
          <div className="py-20 text-center text-[var(--faint)]">読み込み中…</div>
        ) : !data?.referral_code ? (
          <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--panel)] py-16 text-center text-[var(--faint)]">
            <p>招待リンクの取得にはログインが必要です</p>
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <p className="text-xs text-[var(--faint)]">あなたの招待リンク</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 truncate rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:border-[var(--accent)]"
                >
                  {copied ? 'コピー済み' : 'コピー'}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <p className="text-sm text-[var(--dim)]">招待した人数</p>
              <p className="mt-1 text-3xl font-bold">{data.invited_count}</p>
              {data.invited_at.length > 0 && (
                <div className="mt-4 space-y-1 border-t border-[var(--line)] pt-3">
                  {data.invited_at.slice(0, 10).map((d, i) => (
                    <p key={i} className="text-xs text-[var(--faint)]">
                      {new Date(d).toLocaleDateString('ja-JP')} に登録
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
