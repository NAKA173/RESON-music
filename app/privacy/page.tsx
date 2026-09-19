import Link from 'next/link'

export const metadata = { title: '個人データの取扱い | RESON' }
export const dynamic = 'force-dynamic'

const operator = process.env.PRIVACY_OPERATOR_NAME
const address = process.env.PRIVACY_OPERATOR_ADDRESS
const contact = process.env.PRIVACY_CONTACT_EMAIL
const retention = process.env.PRIVACY_RETENTION_POLICY
const transfer = process.env.PRIVACY_TRANSFER_NOTICE
const representative = process.env.PRIVACY_EU_REPRESENTATIVE

function RequiredValue({ value }: { value: string | undefined }) {
  return <span className={value ? '' : 'text-amber-300'}>{value || '未設定（EU向け提供前に記入が必要）'}</span>
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">← RESON</Link>
        <header>
          <h1 className="text-3xl font-semibold">個人データの取扱い</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">RESONで扱う情報と、利用者が選べる設定・請求方法をご案内します。</p>
        </header>
        <section className="space-y-2 border-t border-zinc-800 pt-6 text-sm leading-6">
          <h2 className="text-lg font-medium">運営者と連絡先</h2>
          <p>運営者: <RequiredValue value={operator} /></p>
          <p>所在地: <RequiredValue value={address} /></p>
          <p>個人データに関する連絡先: <RequiredValue value={contact} /></p>
          {representative && <p>EU域内の代理人: {representative}</p>}
        </section>
        <section className="space-y-3 border-t border-zinc-800 pt-6 text-sm leading-6">
          <h2 className="text-lg font-medium">情報の種類と利用目的</h2>
          <ul className="list-disc space-y-2 pl-5 text-zinc-300">
            <li>メールアドレス・認証情報: アカウントの作成、ログイン、本人確認と連絡。</li>
            <li>再生記録・応援記録: 再生サービス、分配計算、不正利用の調査。設定で許可した場合のみ、聴取履歴をおすすめと音楽人格タグの提案にも使用します。</li>
            <li>プロフィール、投稿、コメント、メッセージ: 利用者が選んだ交流機能の提供。公開した内容は他の利用者に見える場合があります。</li>
            <li>購入・支払、アーティストの出金先: 決済、分配、会計と法令に基づく記録の管理。</li>
            <li>未成年アーティストの保護者情報・学生認証情報: 申請審査と資格確認。</li>
          </ul>
          <p className="text-zinc-400">契約の履行、法的義務、不正防止の正当な利益、任意機能への同意など、目的に応じた根拠で取り扱います。任意の聴取履歴利用は設定からいつでも停止できます。</p>
        </section>
        <section className="space-y-3 border-t border-zinc-800 pt-6 text-sm leading-6">
          <h2 className="text-lg font-medium">保存と外部サービス</h2>
          <p className="text-zinc-300">認証・データ保存にSupabase、楽曲等の保存にCloudflare R2、決済にStripe、通知メールにResendを利用する構成です。各サービスの利用地域と契約内容は運営環境により変わります。</p>
          <p>保存期間・削除基準: <RequiredValue value={retention} /></p>
          <p>EU域外への移転先と保護措置: <RequiredValue value={transfer} /></p>
          <p className="text-zinc-400">ブラウザではログイン維持に必要なCookieと、画面テーマ・音量設定などの保存領域を使用します。広告や解析など非必須の端末保存を追加する際は、必要な同意を別途取得します。</p>
        </section>
        <section className="space-y-3 border-t border-zinc-800 pt-6 text-sm leading-6">
          <h2 className="text-lg font-medium">利用者の選択と請求</h2>
          <p className="text-zinc-300">公開範囲や任意の聴取履歴利用は<Link href="/settings" className="underline">設定</Link>から変更できます。開示、訂正、移転用コピー、削除、処理の制限・異議は、ログイン後の<Link href="/privacy-requests" className="underline">個人データ請求</Link>から申し出られます。</p>
          <p className="text-zinc-300">請求内容と本人確認・保存義務を確認して回答します。原則として受け付けから1か月以内に回答し、対応できない場合は理由をお伝えします。監督機関に申し立てる権利もあります。</p>
        </section>
      </div>
    </main>
  )
}
