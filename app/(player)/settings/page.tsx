'use client'

import { useEffect, useState, useCallback } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

interface Settings {
  is_private: boolean
  profile_public: boolean
  feed_enabled: boolean
  follow_enabled: boolean
  matching_enabled: boolean
  comment_enabled: boolean
  community_enabled: boolean
  collection_public: boolean
  follow_request_from: string
  dm_from: string
  comment_notif_from: string
  like_notif: boolean
  matching_suggestion: boolean
  artist_news: string
  support_history_public: boolean
  exclusive_content: boolean
  backer_community: boolean
  score_public: boolean
  listening_data_use: boolean
}

const DEFAULTS: Settings = {
  is_private: false,
  profile_public: false,
  feed_enabled: false,
  follow_enabled: true,
  matching_enabled: true,
  comment_enabled: true,
  community_enabled: true,
  collection_public: true,
  follow_request_from: '全員',
  dm_from: '全員',
  comment_notif_from: '全員',
  like_notif: true,
  matching_suggestion: true,
  artist_news: '全て通知',
  support_history_public: true,
  exclusive_content: true,
  backer_community: true,
  score_public: true,
  listening_data_use: false,
}

function Toggle({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="shrink-0 mt-0.5">
      <button
        role="switch"
        aria-checked={value}
        aria-label={`${label}を切り替える`}
        id={id}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-[22px] rounded-full transition-colors ${value ? 'bg-white' : 'bg-zinc-600'}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-black rounded-full transition-transform ${value ? 'translate-x-[18px]' : ''}`}
        />
      </button>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[13px] px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white cursor-pointer min-w-[130px] shrink-0"
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (!r.ok) throw new Error('settings fetch failed')
        return r.json()
      })
      .then((d) => {
        if (d.settings && Object.keys(d.settings).length > 0) {
          setS({ ...DEFAULTS, ...d.settings })
        }
        setLoaded(true)
      })
      .catch(() => setError('設定を取得できませんでした。再読み込みしてください。'))
  }, [])

  const update = useCallback(async (patch: Partial<Settings>) => {
    if (saving) return
    let previous: Settings | undefined
    setS((current) => {
      previous = current
      return { ...current, ...patch }
    })
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) throw new Error('settings update failed')
    } catch {
      if (previous) setS(previous)
      setError('保存に失敗しました。接続を確認してもう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }, [saving])

  if (!loaded) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto max-w-[680px]">
          <h1 className="text-[22px] font-medium">プライバシーと機能</h1>
          <p role={error ? 'alert' : 'status'} className="mt-5 text-sm text-zinc-400">
            {error || '設定を読み込み中…'}
          </p>
          {error && <button onClick={() => window.location.reload()} className="mt-4 text-sm underline">再読み込み</button>}
        </div>
      </main>
    )
  }

  return (
    <main aria-busy={saving} className="min-h-screen bg-black text-white px-4 py-8">
      <div className="max-w-[680px] mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[22px] font-medium">プライバシーと機能</h1>
          {saving && <span className="text-xs text-zinc-500">保存中…</span>}
        </div>
        <p className="text-sm text-zinc-500 mb-8">Resonの各機能について、参加するかどうかを選べます。</p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</p>}

        {/* 表示設定 */}
        <Section title="表示">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-zinc-300">ライト / ダークモード</p>
              <p className="text-[13px] text-zinc-500 mt-0.5">ホーム画面など一部のページに適用されます</p>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        {/* アカウント公開設定 */}
        <Section title="アカウントの公開設定">
          <div className={`rounded-xl border px-4 py-3 flex gap-3 mb-4 transition-colors ${
            s.is_private ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950 border-zinc-800'
          }`}>
            <span className="text-xl mt-0.5 shrink-0">🔒</span>
            <div className="flex-1 min-w-0">
              <p className={`text-[15px] font-medium ${s.is_private ? 'text-white' : 'text-zinc-400'}`}>
                非公開アカウント
              </p>
              <p className="text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
                オンにすると、公開設定にかかわらずプロフィールと投稿を他の利用者から非表示にします。
              </p>
            </div>
            <Toggle id="t-private" label="非公開アカウント" value={s.is_private} onChange={(v) => update({ is_private: v })} />
          </div>
        </Section>

        {/* SNS機能 */}
        <Section title="SNS機能">
          <Card>
            <Row label="プロフィールページ" desc="音楽趣味・好きなアーティスト・遍歴を公開する">
              <Toggle id="t-profile" label="プロフィールページ" value={s.profile_public} onChange={(v) => update({ profile_public: v })} />
            </Row>
            <Row label="音楽タイムライン（投稿）" desc="楽曲投稿・アルバムレビュー・音楽日記・プレイリスト共有">
              <Toggle id="t-feed" label="音楽タイムライン" value={s.feed_enabled} onChange={(v) => update({ feed_enabled: v })} />
            </Row>
            <Row label="フォロー機能" desc="ユーザー・アーティスト・プレイリスト制作者をフォローできる">
              <Toggle id="t-follow" label="フォロー機能" value={s.follow_enabled} onChange={(v) => update({ follow_enabled: v })} />
            </Row>
            <Row label="音楽マッチング" desc="趣味が近いユーザーを発見・共通アーティスト表示">
              <Toggle id="t-match" label="音楽マッチング" value={s.matching_enabled} onChange={(v) => update({ matching_enabled: v })} />
            </Row>
            <Row label="コメント・レビュー" desc="楽曲・アルバムへの感想・時間指定・考察コメント">
              <Toggle id="t-comment" label="コメント・レビュー" value={s.comment_enabled} onChange={(v) => update({ comment_enabled: v })} />
            </Row>
            <Row label="コミュニティ参加" desc="ジャンル別コミュニティへの投稿・参加">
              <Toggle id="t-community" label="コミュニティ参加" value={s.community_enabled} onChange={(v) => update({ community_enabled: v })} />
            </Row>
            <Row label="音楽コレクション" desc="人生アルバム・年間ベストなどを公開する" last>
              <Toggle id="t-collection" label="音楽コレクション" value={s.collection_public} onChange={(v) => update({ collection_public: v })} />
            </Row>
          </Card>
        </Section>

        {/* 受信の可否 */}
        <Section title="受信の可否">
          <Card>
            <Row label="フォローリクエスト" desc="誰からのフォローリクエストを受け取るか" disabled={!s.follow_enabled}>
              <Select
                label="フォローリクエストの受信範囲"
                value={s.follow_request_from}
                options={['全員', '相互フォロー', '誰も受け取らない']}
                onChange={(v) => update({ follow_request_from: v })}
              />
            </Row>
            <Row label="ダイレクトメッセージ" desc="誰からのDMを受け取るか">
              <Select
                label="ダイレクトメッセージの受信範囲"
                value={s.dm_from}
                options={['全員', 'フォロワーのみ', '受け取らない']}
                onChange={(v) => update({ dm_from: v })}
              />
            </Row>
            <Row label="コメント通知" desc="自分の投稿へのコメント通知" disabled={!s.comment_enabled}>
              <Select
                label="コメント通知の受信範囲"
                value={s.comment_notif_from}
                options={['全員', 'フォロワーのみ', '受け取らない']}
                onChange={(v) => update({ comment_notif_from: v })}
              />
            </Row>
            <Row label="いいね・応援の通知">
              <Select
                label="いいね・応援の通知"
                value={s.like_notif ? 'オン' : 'オフ'}
                options={['オン', 'オフ']}
                onChange={(v) => update({ like_notif: v === 'オン' })}
              />
            </Row>
            <Row label="マッチング提案" desc="「音楽相性が近い人」のサジェスト通知">
              <Select
                label="マッチング提案"
                value={s.matching_suggestion ? '受け取る' : '受け取らない'}
                options={['受け取る', '受け取らない']}
                onChange={(v) => update({ matching_suggestion: v === '受け取る' })}
              />
            </Row>
            <Row label="アーティストの新着情報" desc="フォロー中アーティストの投稿・イベント通知" last>
              <Select
                label="アーティストの新着情報"
                value={s.artist_news}
                options={['全て通知', '重要のみ', '受け取らない']}
                onChange={(v) => update({ artist_news: v })}
              />
            </Row>
          </Card>
        </Section>

        {/* 支援・クラファン機能 */}
        <Section title="支援・クラファン機能">
          <Card>
            <Row label="応援・支援履歴の公開" desc="支援したプロジェクト・アーティストをプロフィールに表示">
              <Toggle id="t-support-hist" label="応援・支援履歴の公開" value={s.support_history_public} onChange={(v) => update({ support_history_public: v })} />
            </Row>
            <Row label="限定コンテンツの受信" desc="支援者向けデモ音源・未公開曲・制作メモ">
              <Toggle id="t-exclusive" label="限定コンテンツの受信" value={s.exclusive_content} onChange={(v) => update({ exclusive_content: v })} />
            </Row>
            <Row label="支援者コミュニティ参加" desc="プロジェクトごとの支援者タブへの参加" last>
              <Toggle id="t-backer" label="支援者コミュニティ参加" value={s.backer_community} onChange={(v) => update({ backer_community: v })} />
            </Row>
          </Card>
        </Section>

        {/* データ・評価 */}
        <Section title="データ・評価">
          <Card>
            <Row label="信頼度スコアの公開" desc="新人発見数・レビュー評価などの指標を表示">
              <Toggle id="t-score" label="信頼度スコアの公開" value={s.score_public} onChange={(v) => update({ score_public: v })} />
            </Row>
            <Row label="リスニングデータの利用" desc="オンにした場合のみ、聴取履歴をおすすめと音楽人格タグの提案に利用します。いつでもオフにできます。再生・分配に必要な記録は継続します。" last>
              <Toggle id="t-listen" label="リスニングデータの利用" value={s.listening_data_use} onChange={(v) => update({ listening_data_use: v })} />
            </Row>
          </Card>
        </Section>
        <Section title="個人データの請求">
          <Link href="/privacy-requests" className="block rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white hover:border-zinc-600">
            開示・移転用コピー・削除などを請求する →
          </Link>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[13px] font-medium text-zinc-500 uppercase tracking-[0.06em] mb-3 pb-2 border-b border-zinc-800">
        {title}
      </p>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4">
      {children}
    </div>
  )
}

function Row({
  label, desc, children, last = false, disabled = false,
}: {
  label: string
  desc?: string
  children: React.ReactNode
  last?: boolean
  disabled?: boolean
}) {
  return (
    <div className={`flex items-start justify-between py-[14px] gap-4 transition-opacity ${
      !last ? 'border-b border-zinc-800' : ''
    } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="min-w-0">
        <p className="text-[15px] text-white">{label}</p>
        {desc && <p className="text-[13px] text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {children}
    </div>
  )
}
