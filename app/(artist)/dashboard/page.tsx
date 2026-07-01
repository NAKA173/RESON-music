'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Distribution {
  year_month: string
  distribution_yen: number
  tips_yen: number
  score_breakdown: {
    play_time_score: number
    support_rate: number
    completion_rate: number
  }
}

interface Track {
  id: string
  title: string
  cumulative_plays: number
  in_distribution: boolean
  ai_generated: boolean
  review_status: 'pending' | 'approved' | 'rejected'
}

interface ReportData {
  artist: { id: string; name: string; review_status: 'pending' | 'approved' | 'rejected' }
  balance: { balance_yen: number; dormant: boolean }
  distributions: Distribution[]
  tracks: Track[]
}

interface PayoutRequest {
  id: string
  amount_yen: number
  status: 'pending' | 'paid' | 'rejected'
  requested_at: string
}

interface AlbumSummary {
  id: string
  title: string
  released_at: string | null
}

interface BankAccount {
  bank_name: string
  branch_name: string
  account_type: 'ordinary' | 'checking'
  account_number: string
  account_holder_name: string
}

export default function DashboardPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([])
  const [payoutError, setPayoutError] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [albums, setAlbums] = useState<AlbumSummary[]>([])
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [editingBank, setEditingBank] = useState(false)
  const [bankForm, setBankForm] = useState<BankAccount>({
    bank_name: '', branch_name: '', account_type: 'ordinary', account_number: '', account_holder_name: '',
  })
  const [bankError, setBankError] = useState('')
  const [bankSaved, setBankSaved] = useState(false)

  useEffect(() => {
    fetch('/api/artist/report')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
    fetch('/api/payout/request')
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setPayoutRequests(d.requests ?? []))
    fetch('/api/albums?mine=true')
      .then((r) => (r.ok ? r.json() : { albums: [] }))
      .then((d) => setAlbums(d.albums ?? []))
    fetch('/api/artist/bank-account')
      .then((r) => (r.ok ? r.json() : { bank_account: null }))
      .then((d) => setBankAccount(d.bank_account))
  }, [])

  async function saveBankAccount(e: React.FormEvent) {
    e.preventDefault()
    setBankError('')
    const res = await fetch('/api/artist/bank-account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankForm),
    })
    const body = await res.json()
    if (!res.ok) { setBankError(body.error); return }
    setEditingBank(false)
    setBankSaved(true)
    setTimeout(() => setBankSaved(false), 2000)
    fetch('/api/artist/bank-account')
      .then((r) => r.json())
      .then((d) => setBankAccount(d.bank_account))
  }

  async function requestPayout() {
    setPayoutError('')
    setPayoutLoading(true)
    const res = await fetch('/api/payout/request', { method: 'POST' })
    const body = await res.json()
    setPayoutLoading(false)
    if (!res.ok) {
      setPayoutError(body.error)
      return
    }
    setPayoutRequests((prev) => [body.request, ...prev])
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中…</p>
      </main>
    )
  }

  if (!data || !data.artist) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">アーティスト登録が必要です</p>
          <Link href="/register" className="text-white underline">登録する</Link>
        </div>
      </main>
    )
  }

  const latest = data.distributions[0]

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{data.artist.name}</h1>
            <p className="text-sm text-zinc-400">アーティストダッシュボード</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/report"
              className="text-sm border border-zinc-700 px-4 py-2 rounded-lg font-semibold hover:border-zinc-400 transition"
            >
              レポート
            </Link>
            <Link
              href="/upload"
              className="text-sm bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-zinc-200 transition"
            >
              + アップロード
            </Link>
          </div>
        </div>

        {/* 審査ステータス */}
        {data.artist.review_status === 'pending' && (
          <div className="bg-zinc-900 border border-yellow-800 rounded-2xl p-4 text-sm text-yellow-400">
            審査中です。審査完了まで楽曲のアップロード・運用は可能ですが、配信開始には審査の承認が必要です。
          </div>
        )}
        {data.artist.review_status === 'rejected' && (
          <div className="bg-zinc-900 border border-red-800 rounded-2xl p-4 text-sm text-red-400">
            審査の結果、登録が承認されませんでした。詳細はサポートにお問い合わせください。
          </div>
        )}

        {/* 残高カード */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <p className="text-sm text-zinc-400">未払い残高</p>
          <p className="text-4xl font-bold mt-1">
            ¥{Math.floor(data.balance.balance_yen).toLocaleString()}
          </p>
          {data.balance.balance_yen >= 1000 ? (
            <p className="text-xs text-zinc-500 mt-2">毎月末締め・翌月15日払い</p>
          ) : (
            <p className="text-xs text-zinc-600 mt-2">出金最低額は¥1,000（翌月へ繰り越し）</p>
          )}
          {data.balance.balance_yen >= 50000 && (
            <p className="text-xs text-yellow-500 mt-2">⚠️ 残高が50,000円を超えています。出金申請を行ってください。</p>
          )}

          {payoutError && (
            <p className="text-xs text-red-400 mt-3">{payoutError}</p>
          )}

          {payoutRequests.some((r) => r.status === 'pending') ? (
            <p className="text-xs text-zinc-500 mt-3">出金申請受付済み（処理中）</p>
          ) : (
            <button
              onClick={requestPayout}
              disabled={data.balance.balance_yen < 1000 || payoutLoading}
              className="mt-3 text-sm bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-zinc-200 disabled:opacity-40 transition"
            >
              {payoutLoading ? '申請中…' : '出金申請'}
            </button>
          )}

          {payoutRequests.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-zinc-800 pt-3">
              {payoutRequests.slice(0, 5).map((r) => (
                <div key={r.id} className="flex justify-between text-xs text-zinc-500">
                  <span>{new Date(r.requested_at).toLocaleDateString('ja-JP')}</span>
                  <span>¥{Math.floor(r.amount_yen).toLocaleString()}</span>
                  <span>
                    {r.status === 'pending' ? '処理中' : r.status === 'paid' ? '支払済' : '却下'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最新月のスコア内訳 */}
        {latest && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{latest.year_month} の熱量スコア</h2>
              <p className="text-sm text-zinc-400">
                ¥{Math.floor(latest.distribution_yen).toLocaleString()}
              </p>
            </div>
            <div className="space-y-3">
              <ScoreBar
                label="再生時間スコア"
                value={latest.score_breakdown.play_time_score}
                weight={0.4}
                desc="SUM(再生秒 × 重み係数 × 秒数係数) / 3600"
              />
              <ScoreBar
                label="応援率"
                value={latest.score_breakdown.support_rate * 100}
                weight={0.35}
                isPercent
                desc="応援数 / 有効再生数"
              />
              <ScoreBar
                label="完聴率"
                value={latest.score_breakdown.completion_rate * 100}
                weight={0.25}
                isPercent
                desc="完聴数 / 有効再生数"
              />
            </div>
            <p className="text-xs text-zinc-600 border-t border-zinc-800 pt-3">
              投げ銭収益（別計算）: ¥{latest.tips_yen?.toLocaleString() ?? 0}
            </p>
          </div>
        )}

        {/* 月次履歴 */}
        {data.distributions.length > 1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h2 className="font-semibold">月次分配履歴</h2>
            {data.distributions.map((d) => (
              <div key={d.year_month} className="flex justify-between text-sm border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <span className="text-zinc-300">{d.year_month}</span>
                <span>¥{Math.floor(d.distribution_yen).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* 楽曲リスト */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">楽曲</h2>
          {data.tracks.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ楽曲がありません</p>
          ) : (
            data.tracks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate">{t.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    {t.review_status === 'pending' && (
                      <span className="text-xs text-yellow-500">審査中</span>
                    )}
                    {t.review_status === 'rejected' && (
                      <span className="text-xs text-red-400">却下</span>
                    )}
                    {t.ai_generated && (
                      <span className="text-xs text-yellow-600">AI生成</span>
                    )}
                    {!t.in_distribution && (
                      <span className="text-xs text-zinc-600">
                        分配対象外（{t.cumulative_plays}/100再生）
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-zinc-400 ml-3 shrink-0">
                  {t.cumulative_plays.toLocaleString()}再生
                </span>
              </div>
            ))
          )}
        </div>

        {/* 出金先銀行口座 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">出金先銀行口座</h2>
            <button
              onClick={() => {
                if (bankAccount) setBankForm(bankAccount)
                setEditingBank((v) => !v)
              }}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              {editingBank ? 'キャンセル' : '編集する'}
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            出金申請が承認されると、運営がこの口座情報を参照して毎月15日payoutで手動振込を行います
            （銀行APIとの自動連携は未実装のため、振込自体は人力オペレーションです）。
          </p>

          {!editingBank ? (
            bankAccount ? (
              <div className="text-sm text-zinc-300 space-y-1">
                <p>{bankAccount.bank_name} {bankAccount.branch_name}</p>
                <p>{bankAccount.account_type === 'ordinary' ? '普通' : '当座'} {bankAccount.account_number}</p>
                <p className="text-zinc-500">{bankAccount.account_holder_name}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">口座情報が登録されていません</p>
            )
          ) : (
            <form onSubmit={saveBankAccount} className="space-y-2">
              <input
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                placeholder="銀行名"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              <input
                value={bankForm.branch_name}
                onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                placeholder="支店名"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              <select
                value={bankForm.account_type}
                onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value as 'ordinary' | 'checking' })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-400"
              >
                <option value="ordinary">普通</option>
                <option value="checking">当座</option>
              </select>
              <input
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                placeholder="口座番号"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              <input
                value={bankForm.account_holder_name}
                onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                placeholder="口座名義（カナ）"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
              {bankError && <p className="text-xs text-red-400">{bankError}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-white py-2 text-sm font-semibold text-black hover:bg-zinc-200"
              >
                保存する
              </button>
            </form>
          )}
          {bankSaved && <p className="text-xs text-emerald-400">保存しました</p>}
        </div>

        {/* アルバム */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">アルバム</h2>
            <Link href="/upload" className="text-xs text-zinc-400 hover:text-white underline">
              アップロード時に作成
            </Link>
          </div>
          {albums.length === 0 ? (
            <p className="text-sm text-zinc-500">まだアルバムがありません</p>
          ) : (
            albums.map((a) => (
              <div key={a.id} className="flex justify-between text-sm border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <span className="truncate">{a.title}</span>
                <span className="text-zinc-500 text-xs">
                  {a.released_at ? new Date(a.released_at).toLocaleDateString('ja-JP') : '未発表日'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 紹介・透明性リンク */}
        <p className="text-center text-xs text-zinc-600 space-x-4">
          <Link href="/invite" className="hover:text-zinc-400 underline">
            友人を招待する
          </Link>
          <Link href="/pricing" className="hover:text-zinc-400 underline">
            分配計算式はこちらで公開しています
          </Link>
        </p>
      </div>
    </main>
  )
}

function ScoreBar({
  label, value, weight, isPercent = false, desc,
}: {
  label: string
  value: number
  weight: number
  isPercent?: boolean
  desc: string
}) {
  const display = isPercent
    ? `${value.toFixed(1)}%`
    : value.toFixed(4)
  const pct = isPercent ? Math.min(value, 100) : Math.min(value * 100, 100)

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>
          {label}
          <span className="text-zinc-500 ml-1.5 text-xs">× {weight}</span>
        </span>
        <span className="text-zinc-300">{display}</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div className="bg-white h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
    </div>
  )
}
