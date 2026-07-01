'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    features: ['月15時間まで', '広告あり', '標準音質'],
    highlight: false,
  },
  {
    id: 'standard' as const,
    name: 'Standard',
    price: 750,
    features: ['無制限', '広告なし', '標準音質', '応援ボタン'],
    highlight: false,
  },
  {
    id: 'student' as const,
    name: 'Student',
    price: 250,
    features: ['無制限', '広告なし', '標準音質', '.ed.jpメール認証が必要'],
    highlight: false,
  },
  {
    id: 'support_plus' as const,
    name: 'Support+',
    price: 1000,
    features: ['無制限', '広告なし', '高音質', '応援ボーナス（重み1.3）', '投げ銭手数料 3.6%のみ'],
    highlight: true,
  },
]

function PricingContent() {
  const router = useRouter()
  const params = useSearchParams()
  const success = params.get('success') === '1'
  const [loading, setLoading] = useState<string | null>(null)
  const [studentStep, setStudentStep] = useState<'closed' | 'email' | 'code'>('closed')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [studentError, setStudentError] = useState('')
  const [studentBusy, setStudentBusy] = useState(false)

  async function subscribe(planId: string) {
    if (planId === 'free') return
    if (planId === 'student') {
      setStudentError('')
      setStudentStep('email')
      return
    }
    setLoading(planId)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) {
      alert(data.error)
      return
    }
    router.push(data.url)
  }

  async function sendStudentCode() {
    setStudentBusy(true)
    setStudentError('')
    const res = await fetch('/api/student/verify/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_email: schoolEmail }),
    })
    const data = await res.json()
    setStudentBusy(false)
    if (!res.ok) { setStudentError(data.error); return }
    setStudentStep('code')
  }

  async function confirmStudentCode() {
    setStudentBusy(true)
    setStudentError('')
    const res = await fetch('/api/student/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: verifyCode }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStudentBusy(false)
      setStudentError(data.error)
      return
    }
    setStudentStep('closed')
    await subscribeStudent()
  }

  async function subscribeStudent() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'student' }),
    })
    const data = await res.json()
    setStudentBusy(false)
    if (!res.ok) { alert(data.error); return }
    router.push(data.url)
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    router.push(data.url)
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold">料金プラン</h1>
          <p className="text-zinc-400 mt-2">聴くほどアーティストへ還元される</p>
        </div>

        {success && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl px-5 py-4 text-green-300 text-sm text-center">
            サブスクリプションの登録が完了しました 🎉
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                plan.highlight
                  ? 'border-white bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              {plan.highlight && (
                <span className="text-xs bg-white text-black font-bold px-2 py-0.5 rounded-full self-start">
                  おすすめ
                </span>
              )}
              <div>
                <p className="text-lg font-bold">{plan.name}</p>
                <p className="text-3xl font-bold mt-1">
                  {plan.price === 0 ? '無料' : `¥${plan.price.toLocaleString()}`}
                  {plan.price > 0 && <span className="text-sm font-normal text-zinc-400">/月</span>}
                </p>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-zinc-500 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id !== 'free' && (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'border border-zinc-600 text-white hover:bg-zinc-800'
                  }`}
                >
                  {loading === plan.id ? '処理中…' : `${plan.name} に登録`}
                </button>
              )}
            </div>
          ))}
        </div>

        {studentStep !== 'closed' && (
          <div className="border border-zinc-700 rounded-2xl p-6 max-w-sm mx-auto space-y-3">
            <p className="font-semibold text-sm">Studentプラン認証</p>
            <p className="text-xs text-zinc-500">学校発行の .ed.jp メールアドレスで本人確認が必要です</p>
            {studentStep === 'email' && (
              <>
                <input
                  type="email"
                  placeholder="example@school.ed.jp"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                />
                <button
                  onClick={sendStudentCode}
                  disabled={studentBusy || !schoolEmail}
                  className="w-full rounded-lg py-2 text-sm font-semibold bg-white text-black disabled:opacity-50"
                >
                  {studentBusy ? '送信中…' : '認証コードを送信'}
                </button>
              </>
            )}
            {studentStep === 'code' && (
              <>
                <input
                  type="text"
                  placeholder="6桁のコード"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                />
                <button
                  onClick={confirmStudentCode}
                  disabled={studentBusy || !verifyCode}
                  className="w-full rounded-lg py-2 text-sm font-semibold bg-white text-black disabled:opacity-50"
                >
                  {studentBusy ? '確認中…' : '確認して登録へ進む'}
                </button>
              </>
            )}
            {studentError && <p className="text-xs text-red-400">{studentError}</p>}
            <button onClick={() => setStudentStep('closed')} className="text-xs text-zinc-500 underline">
              キャンセル
            </button>
          </div>
        )}

        <div className="text-center space-x-4">
          <button
            onClick={openPortal}
            className="text-sm text-zinc-500 hover:text-zinc-300 underline transition"
          >
            プランの変更・解約はこちら
          </button>
          <a href="/parental" className="text-sm text-zinc-500 hover:text-zinc-300 underline transition">
            未成年の方はこちら（保護者の決済に紐付ける）
          </a>
        </div>

        {/* 分配の透明性（仕様書: 計算式はパブリックに公開） */}
        <div className="border border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-bold">分配の仕組み（透明性ポリシー）</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            月額の75〜80%がアーティスト分配プールに入ります。
            再生時間・応援率・完聴率から「熱量スコア」を算出し、スコア比率で按分します。
            再生数ではなく<strong className="text-white">熱量</strong>で分配するため、インディーズアーティストが有利です。
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            応援率には❤️・投げ銭に加え、ブーストハート🚀（月3回まで無料・以降1回30円・月23回上限）が
            <strong className="text-white">重み2倍</strong>で反映されます。ブーストの追加課金分（30円）は
            プール按分を経由せず、ブーストしたアーティストへ直接70%（21円）が渡ります。
          </p>
          <table className="w-full text-sm text-zinc-400 border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 font-normal">プラン</th>
                <th className="text-right py-2 font-normal">再生重み</th>
                <th className="text-right py-2 font-normal">プールへの寄与</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Support+', weight: '1.3', pool: '¥800/月' },
                { name: 'Standard', weight: '1.0', pool: '¥562/月' },
                { name: 'Student', weight: '0.7', pool: '¥200/月' },
                { name: 'Free', weight: '0.4', pool: '¥42/月（広告収益）' },
              ].map((r) => (
                <tr key={r.name} className="border-b border-zinc-900">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right">{r.weight}</td>
                  <td className="py-2 text-right">{r.pool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}
