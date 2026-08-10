'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'account' | 'confirm-email' | 'artist' | 'bank' | 'rights' | 'done'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [bankName, setBankName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [accountType, setAccountType] = useState<'ordinary' | 'checking'>('ordinary')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [isMinor, setIsMinor] = useState(false)
  const [parentConsentName, setParentConsentName] = useState('')
  const [parentConsentContact, setParentConsentContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) sessionStorage.setItem('reson_ref', ref)
  }, [])

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    const ref = sessionStorage.getItem('reson_ref')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ref }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    sessionStorage.removeItem('reson_ref')
    setStep(data.needs_email_confirmation ? 'confirm-email' : 'artist')
  }

  function nextFromArtist(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('bank')
  }

  function nextFromBank(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('rights')
  }

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault()
    if (!rightsConfirmed) {
      setError('権利確認への同意が必要です')
      return
    }
    if (isMinor && (!parentConsentName.trim() || !parentConsentContact.trim())) {
      setError('未成年の場合は保護者の氏名・連絡先が必要です')
      return
    }
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/register-artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        bio,
        rights_confirmed: rightsConfirmed,
        bank: {
          bank_name: bankName,
          branch_name: branchName,
          account_type: accountType,
          account_number: accountNumber,
          account_holder_name: accountHolderName,
        },
        is_minor: isMinor,
        parent_consent_name: isMinor ? parentConsentName : undefined,
        parent_consent_contact: isMinor ? parentConsentContact : undefined,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setStep('done')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">RESON</h1>
          <p className="mt-2 text-sm text-zinc-400">アーティスト登録</p>
        </div>

        {step !== 'done' && step !== 'confirm-email' && <StepIndicator current={step} />}

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {step === 'account' && (
          <form onSubmit={createAccount} className="space-y-4">
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
            <div>
              <label className="block text-sm text-zinc-400 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              />
              <p className="mt-1 text-xs text-zinc-600">8文字以上</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">パスワード（確認）</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '登録中…' : 'アカウントを作成'}
            </button>
          </form>
        )}

        {step === 'confirm-email' && (
          <div className="text-center space-y-4">
            <p className="text-4xl">📩</p>
            <h2 className="text-lg font-bold">確認メールを送信しました</h2>
            <p className="text-sm text-zinc-400">
              {email} に届いた確認リンクをクリックしてください。確認後、ログインしてアーティスト登録を続けられます。
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 transition"
            >
              ログインへ
            </button>
          </div>
        )}

        {step === 'artist' && (
          <form onSubmit={nextFromArtist} className="space-y-4">
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
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 transition"
            >
              次へ（出金先の登録）
            </button>
          </form>
        )}

        {step === 'bank' && (
          <form onSubmit={nextFromBank} className="space-y-4">
            <p className="text-xs text-zinc-500">
              分配金・出金の受け取り先として使用します。口座名義は登録者本人の氏名と一致させてください。
            </p>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">銀行名 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">支店名 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">口座種別 <span className="text-red-400">*</span></label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'ordinary' | 'checking')}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              >
                <option value="ordinary">普通</option>
                <option value="checking">当座</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">口座番号 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">口座名義（カナ） <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="例: ヤマダ タロウ"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 transition"
            >
              次へ（権利確認）
            </button>
            <button
              type="button"
              onClick={() => setStep('artist')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              戻る
            </button>
          </form>
        )}

        {step === 'rights' && (
          <form onSubmit={submitRegistration} className="space-y-4">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-300 space-y-2">
              <p>アップロードする楽曲について、以下を確認してください。</p>
              <ul className="list-disc list-inside text-zinc-400 space-y-1">
                <li>自身が著作権・実演者の権利を有する、または権利者から許諾を得ている楽曲のみをアップロードします</li>
                <li>第三者の権利を侵害するコンテンツ（無許諾サンプリング・カバー等）は登録しません</li>
                <li>登録した銀行口座情報が正確であることを確認しました</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded accent-white"
              />
              <span className="text-sm">上記の内容に同意します</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer border-t border-zinc-800 pt-4">
              <input
                type="checkbox"
                checked={isMinor}
                onChange={(e) => setIsMinor(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded accent-white"
              />
              <span className="text-sm">未成年です（保護者の同意が必要です）</span>
            </label>
            {isMinor && (
              <div className="space-y-2 pl-8">
                <input
                  type="text"
                  placeholder="保護者の氏名"
                  value={parentConsentName}
                  onChange={(e) => setParentConsentName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                />
                <input
                  type="text"
                  placeholder="保護者の連絡先（電話番号 or メールアドレス）"
                  value={parentConsentContact}
                  onChange={(e) => setParentConsentContact(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                />
                <p className="text-xs text-zinc-600">
                  保護者本人が本登録内容（著作権確認・銀行口座情報を含む）に同意していることを確認してください。
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !rightsConfirmed}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {loading ? '登録中…' : '登録を申請する'}
            </button>
            <button
              type="button"
              onClick={() => setStep('bank')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              戻る
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <p className="text-4xl">🛠️</p>
            <h2 className="text-lg font-bold">登録申請を受け付けました</h2>
            <p className="text-sm text-zinc-400">
              現在審査中です。審査完了まで楽曲の配信開始をお待ちください。アップロード自体は審査結果を待たずに行えます。
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-zinc-200 transition"
            >
              ダッシュボードへ
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function StepIndicator({ current }: { current: Exclude<Step, 'done' | 'confirm-email'> }) {
  const steps: { key: Exclude<Step, 'done' | 'confirm-email'>; label: string }[] = [
    { key: 'account', label: 'アカウント' },
    { key: 'artist', label: 'プロフィール' },
    { key: 'bank', label: '出金先' },
    { key: 'rights', label: '権利確認' },
  ]
  const idx = steps.findIndex((s) => s.key === current)

  return (
    <div className="flex items-center justify-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <div className={`flex items-center gap-1 ${i <= idx ? 'text-white' : 'text-zinc-600'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < idx ? 'bg-white text-black' : i === idx ? 'border-2 border-white' : 'border border-zinc-700'}`}>
              {i < idx ? '✓' : i + 1}
            </span>
            <span className="text-xs hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-4 h-px ${i < idx ? 'bg-white' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
