# サービス実装コンテキスト（Claude Code用）

> このファイルはClaude Codeが読む前提で書かれている。
> 仕様書v2.2の内容を実装に必要な形に再構成したもの。
> フェーズが進んだらチェックボックスを更新すること。

---

## サービス思想

「聴くことが、そのまま音楽文化を育てるサブスク」

- 再生数ではなく**熱量**（応援率・完聴率・リピート率）で分配する
- アーティストは**計算式を自分で検証できる**（透明性が根幹）
- 知名度ではなく**相性**で音楽と出会う（発見性の設計）
- 感動した人が**感謝を返せる**設計（強制ではなく任意応援）

既存サービスとの違い：上位1%より**99%のインディーズ・新人アーティスト**が有利になる構造を意図している。

---

## Tech Stack

| Layer | 選択 | 理由 |
|---|---|---|
| Framework | Next.js 15（App Router） | SSR・API Routes・Vercel統合 |
| DB | Supabase（PostgreSQL + pgvector） | 認証・ストレージ・ベクトル検索が統合 |
| Auth | Supabase Auth | SMS認証・メール認証・OAuth |
| Storage | Cloudflare R2 | 音声ファイル。転送コスト最安 |
| Cache | Upstash Redis | サーバーレスRedis。LLMクエリキャッシュ |
| 月額決済 | PAY.JP（2.95%・要確認） or Stripe | サブスク継続課金 |
| 投げ銭決済 | Stripe（初期）→ 独自ウォレット（成長後） | 少額手数料問題は成長後に解決 |
| LLM | Claude API（Haikuのみ） | コスト制御。Sonnet以上は使わない |
| Deploy | Vercel | CI/CD自動 |
| Fingerprint | AcoustID / Chromaprint | 重複楽曲検知 |

---

## DB Schema

```sql
-- ユーザー
users (
  id uuid PK,
  email text UNIQUE,
  plan text CHECK (plan IN ('free','standard','student','support_plus')),
  student_verified bool DEFAULT false,
  parent_user_id uuid REFERENCES users(id),  -- ペアレンタル決済
  currency text DEFAULT 'JPY',               -- 将来の多通貨対応
  created_at timestamptz
)

-- ペアレンタル決済の紐付けリクエスト（トークン方式・メール配信基盤未構築のため本人が
-- リンクを保護者へ直接共有する運用。承認されると users.parent_user_id が設定される）
parental_link_requests (
  id uuid PK,
  child_user_id uuid REFERENCES users(id),
  token text UNIQUE,
  status text DEFAULT 'pending', -- pending/approved/rejected
  parent_user_id uuid REFERENCES users(id),
  created_at timestamptz, resolved_at timestamptz
)

-- アーティスト
artists (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  name text,
  bio text,
  verified_badge bool DEFAULT false,  -- 初回審査通過
  founding_artist bool DEFAULT false, -- 創設アーティスト
  review_status text DEFAULT 'pending', -- pending/approved/rejected（本人確認相当の審査）
  rights_confirmed bool DEFAULT false,
  rights_confirmed_at timestamptz,
  is_minor bool DEFAULT false,          -- 未成年アーティストの親権者同意フロー
  parent_consent_name text,
  parent_consent_contact text,
  created_at timestamptz
)

-- 出金先銀行口座
artist_bank_accounts (
  id uuid PK,
  artist_id uuid REFERENCES artists(id) UNIQUE,
  bank_name text, branch_name text,
  account_type text CHECK (account_type IN ('ordinary','checking')),
  account_number text, account_holder_name text,
  created_at timestamptz, updated_at timestamptz
)

-- 楽曲
tracks (
  id uuid PK,
  artist_id uuid REFERENCES artists(id),
  title text,
  duration_sec int,
  r2_key text,             -- Cloudflare R2のオブジェクトキー
  cover_r2_key text,       -- ジャケット画像（任意）
  fingerprint text,        -- AcoustID
  ai_generated bool DEFAULT false,
  cumulative_plays int DEFAULT 0,
  in_distribution bool DEFAULT false,  -- 100再生超えたらtrue
  review_status text DEFAULT 'pending', -- pending/approved/rejected（楽曲単位の配信審査）
  reviewed_at timestamptz,
  registration_fee_paid bool DEFAULT false,
  track_number int,        -- アルバム内の曲順（nullable）
  created_at timestamptz
)

-- アルバム（楽曲のまとまり。アーティスト本人が任意で作成・楽曲に紐付ける）
albums (
  id uuid PK,
  artist_id uuid REFERENCES artists(id),
  title text,
  cover_url text,          -- 外部URL直接指定（任意・cover_r2_key優先）
  cover_r2_key text,       -- ジャケット画像（R2アップロード）
  release_type text DEFAULT 'album', -- single/ep/album
  released_at date,
  created_at timestamptz
)
-- tracks.album_id uuid REFERENCES albums(id)  -- nullable（シングルはアルバム未紐付け）

-- ベストトラックランキング（Topster風プロフィール・自己申告のお気に入り楽曲ランキング・最大10曲）
best_tracks (
  user_id uuid REFERENCES users(id),
  rank int CHECK (rank BETWEEN 1 AND 10),
  track_id uuid REFERENCES tracks(id),
  created_at timestamptz,
  PRIMARY KEY (user_id, rank),
  UNIQUE (user_id, track_id)
)

-- 共同楽曲の分配設定
track_splits (
  id uuid PK,
  track_id uuid REFERENCES tracks(id),
  artist_id uuid REFERENCES artists(id),
  split_pct numeric CHECK (split_pct > 0 AND split_pct <= 100),
  agreed bool DEFAULT false  -- 全員同意が必要
)

-- 再生ログ（分配計算の根拠・INSERTのみ・UPDATE禁止）
play_events (
  id uuid PK,
  track_id uuid REFERENCES tracks(id),
  user_id uuid REFERENCES users(id),
  user_plan text,
  played_sec int,
  duration_sec int,          -- 楽曲の全長（スナップショット）
  completed bool,            -- 最後まで聴いたか
  weight numeric,            -- user_planから算出した重み係数
  sec_factor numeric,        -- 再生秒数係数（0 / 0.5 / 1.0）
  ip_address text,           -- 不正検知（同一IP大量再生）用
  created_at timestamptz
)

-- 応援（❤️ + 投げ銭）
supports (
  id uuid PK,
  track_id uuid REFERENCES tracks(id),
  user_id uuid REFERENCES users(id),
  amount_yen int DEFAULT 0,       -- 0=❤️のみ
  payment_id text,                -- 決済IDの参照
  created_at timestamptz
)

-- ブーストハート🚀（応援表明の多層化・v3.4第8章）
boost_hearts (
  id uuid PK,
  track_id uuid REFERENCES tracks(id),
  user_id uuid REFERENCES users(id),
  year_month text,                -- "2026-07"
  amount_yen int DEFAULT 0,       -- 0=無料分、30=追加課金分
  payment_id text,
  created_at timestamptz
)

-- 月次分配
monthly_distributions (
  id uuid PK,
  artist_id uuid REFERENCES artists(id),
  year_month text,           -- "2026-07"
  total_pool_yen numeric,
  artist_share_ratio numeric,
  distribution_yen numeric,
  score_breakdown jsonb,     -- {play_time_score, support_score, completion_score}
  tips_yen numeric DEFAULT 0,  -- 投げ銭収益（別計算）
  paid_at timestamptz
)

-- アーティスト残高
artist_balances (
  id uuid PK,
  artist_id uuid REFERENCES artists(id) UNIQUE,
  balance_yen numeric DEFAULT 0,
  last_notified_at timestamptz,  -- 50,000円超え通知日
  dormant bool DEFAULT false,    -- 2年未出金で休眠
  updated_at timestamptz
)

-- Support+投げ銭の月間蓄積（Stripe実費3.6%）
support_plus_tip_batches (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  year_month text,
  total_tips_yen numeric,
  stripe_fee_yen int,     -- ceil(total * 0.036)
  net_yen numeric,        -- total - stripe_fee
  processed bool DEFAULT false
)

-- 不正検知フラグ
fraud_flags (
  id uuid PK,
  track_id uuid REFERENCES tracks(id),
  user_id uuid REFERENCES users(id),
  flag_type text,      -- 'concentrated_plays' | 'same_ip' | 'mechanical_pattern' | 'abnormal_completion'
  level int,           -- 1=警告 2=停止 3=アカウント停止
  resolved bool DEFAULT false,
  created_at timestamptz
)

-- Studentプラン .ed.jp認証コード
student_verifications (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  school_email text,
  code text,
  expires_at timestamptz,   -- 発行から10分
  attempts int DEFAULT 0,   -- 5回まで
  verified bool DEFAULT false,
  created_at timestamptz
)
```

---

## 分配計算ロジック（最重要・バグ禁止・必ずテストを書く）

```
再生重み係数：
  support_plus → 1.3
  standard     → 1.0
  student      → 0.7
  free         → 0.4
  ai_generated → 0.1（通常係数を上書き）

再生秒数係数（sec_factor）：
  played_sec < 30                          → 0.0（算入しない）
  30 <= played_sec < duration_sec * 0.5   → 0.5
  played_sec >= duration_sec * 0.5        → 1.0
  completed = true                         → 完聴率スコアにも加算

熱量スコア（月次バッチで算出）：
  play_time_score    = SUM(played_sec × weight × sec_factor) / 3600
  support_rate       = (COUNT(supports) + COUNT(boost_hearts) × 2.0) / COUNT(play_events) WHERE sec_factor > 0
  completion_rate    = COUNT(completed=true) / COUNT(play_events) WHERE sec_factor > 0

  raw_score = (play_time_score × 0.4)
            + (support_rate   × 0.35)
            + (completion_rate × 0.25)

分配額：
  distribution = total_pool × (artist_raw_score / SUM(all_artists_raw_score))

条件：
  - cumulative_plays < 100 → 分配対象外（in_distribution = false）
  - ai_generated = true    → weight を 0.1 に強制
  - 月額プールの算出元：
      Standard: 750円 × 75% = 562円/人
      Student:  250円 × 80% = 200円/人
      Support+: 1,000円 × 80% = 800円/人
      広告収益: 約60円/人/月 × 70%
      登録手数料: 全額プールへ（翌月算入）
```

---

## 投げ銭手数料

```
Free:     10%（運営マージン含む・v3.1で15%から改定）
Standard:  8%（運営マージン含む）
Student:   6%（運営マージン含む）
Support+:  月間蓄積総額 × 3.6%（Stripe実費のみ・端数切り上げ運営負担）

Support+の実装：
  - 各投げ銭はDBに記録し、month/user_idでグループ化
  - 月末に support_plus_tip_batches を集計
  - stripe_fee = CEIL(total_tips_yen × 0.036)
  - net_yen = total_tips_yen - stripe_fee をアーティストへ送金

注意：投げ銭最低金額は100円（50円は現状Stripe最低手数料120円で赤字になるため）
将来的に独自ウォレット方式への移行を検討（資金決済法の確認が必要）
```

---

## ブーストハート🚀（v3.4第8章）

```
3層構造：
  ①❤️（いいね）   無制限・無料・応援度スコアへの影響は軽微
  ②ブーストハート 月3回まで無料／以降1回30円・月23回上限・重み2倍で応援度スコアに反映
  ③投げ銭         無制限（最低100円）・応援度スコアに反映

月間上限：月3回無料 + 月20回まで追加課金 = 月23回（課金力でスコアを支配させないための天井）

追加ブースト（30円）の分配：
  アーティスト直接受取：21円（70%）— プール按分を経由せず直接送金（投げ銭と同方式）
  運営取得：9円（30%）— 投げ銭より運営取得率を高くする（金銭支援ではなくスコア影響力の購入のため）

注意：Stripeの実用上の最低決済額（JPY 50円）と30円という単価には実装上の懸念が残る（要検証・本番導入前に解決必須）

UIの分離：❤️ボタンとブーストボタン（ロケットモチーフ🚀）は視覚的に完全に別物として実装する
週間ブーストランキング：絶対数ではなく先週比の伸び率ベース（累計再生数500未満の楽曲は対象外）— 未実装
```

---

## 収益化フロー本格化・Support Graph（Phase 1拡張・Phase 2）

```
発覚した不整合の修正：
  app/api/stripe/webhook/route.ts の handleTipSucceeded は、Free/Standard/Student
  プランの投げ銭の net_yen を supports に記録するだけで、artist_balances へ加算する
  処理が存在しなかった（Support+ のみ settle_support_plus_tips で月末精算されていた）。
  → handleTipSucceeded 内で users.plan を確認し、support_plus 以外は即時
    add_artist_balance を呼ぶように修正（ブースト課金と同じ「直接送金」方式に統一）。

フロントエンドの決済確認フローを新規実装（@stripe/stripe-js, @stripe/react-stripe-js 追加）：
  これまで /api/supports・/api/boost は PaymentIntent の client_secret を返すだけで、
  実際にカード情報を入力してpaymentを確定するUIが存在しなかった（決済が完了しない状態）。
  lib/stripe-client.ts            loadStripe() のシングルトン（NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY）
  components/PaymentConfirmModal.tsx  Stripe Elements + PaymentElement の確認モーダル（汎用）
  components/SupportButton.tsx    ❤️ボタン（無料・即時）+ 投げ銭ボタン（プリセット額→決済確認モーダル）
  components/BoostButton.tsx      無料ブーストは即時記録のまま、追加課金分のみ決済確認モーダルに接続
  components/Player.tsx           上記2コンポーネントをプレイヤーUIに追加（従来ブーストのみだった）

Support Graph（応援の連鎖表示）：
  自分がフォロー中のユーザーのうち、再生中の楽曲を応援（❤️・投げ銭・ブースト）した人を表示。
  「相性で出会う」発見性の設計の一部として、知らないアーティストでもフォロー中の人の応援を
  通じて信頼の連鎖から発見できるようにする。
  API: app/api/tracks/[trackId]/support-graph/route.ts
    GET：自分のfollows(followee_type='user')と一致するsupports/boost_heartsのuser_idを集計。
    フォロー中の応援者がいない場合は総応援数のみ返す（プライバシー上、個人の特定はフォロー関係がある場合のみ）。
  UI: components/SupportGraph.tsx（Player内に表示）

追加ブースト（30円）の課金方式変更（Stripe最低決済額50円問題の解決）：
  従来は追加ブーストごとに都度PaymentIntentで課金していたが、30円は
  Stripeの実用上の最低決済額（50円）を下回るため、サブスク契約者（Standard/
  Student/Support+）は都度課金せず、月次カウントを Stripe の pending invoice item
  として積み上げ、次回のサブスク請求（月額利用料）と合算して決済する方式に変更。
  Freeプラン（サブスクなし・合算先の請求サイクルがない）のみ従来の都度課金を維持。

  lib/payment/types.ts, providers/stripe.ts  createPendingInvoiceItem を追加
    （PaymentProviderインターフェースに新規メソッド。Stripeの invoiceItems.create() ラッパー）
  app/api/boost/route.ts   plan!=='free' かつ stripe_customer_id ありの場合は
    createPendingInvoiceItem を呼び、boost_hearts に billed=false で即時記録
  supabase/migrations/20260019_boost_monthly_billing.sql
    boost_hearts.billed カラム追加。settle_monthly_boosts(year_month) 関数で
    月次バッチ実行時に未請求分をアーティスト残高へ70%加算し billed=true に更新
    （app/api/distribution/run で settle_support_plus_tips と同時実行）。
  components/BoostButton.tsx  'deferred_to_invoice' レスポンス時は決済確認モーダルを
    出さず即時成功表示（実際の決済は次回請求時にStripeが自動処理）
```

---

## PaymentProvider抽象化レイヤー（v3.4第3章）

```
目的：決済業者依存のAPI呼び出し（Stripe SDK等）をビジネスロジックから切り離し、
      将来的に他社決済（SBPayment / PayPay等）を追加する際にアプリケーションコード
      （投げ銭・ブースト・サブスク・分配処理）を変更不要にする。

構成：
  lib/payment/types.ts             共通インターフェース PaymentProvider と関連型を定義
  lib/payment/providers/stripe.ts  StripeAdapter（PaymentProviderの唯一の実装・現状）
  lib/payment/index.ts             paymentProvider シングルトンのエクスポート

PaymentProvider interface:
  createCustomer / createOneTimeCharge / createSubscriptionCheckout /
  createBillingPortalSession / verifyAndNormalizeWebhook

  verifyAndNormalizeWebhook は業者ごとに異なるWebhook形式・署名検証ロジックを
  この層に閉じ込め、NormalizedWebhookEvent（共通フォーマット）に変換する。
  呼び出し側（app/api/stripe/webhook/route.ts）は正規化後のkindのみで分岐する。

フェーズ方針（β版・初月）：Stripeアダプターのみ実装。抽象化レイヤーは作るが
  SBPayment/PayPay等の他アダプターは未実装（spec記載の段階導入方針に準拠）。

DB拡張：supports / boost_hearts に payment_provider カラムを追加（default 'stripe'）。
  既存の payment_id カラムは provider_charge_id 相当としてそのまま使用（リネームなし）。

適用済み呼び出し元：
  app/api/supports/route.ts        投げ銭PaymentIntent作成
  app/api/boost/route.ts           追加ブーストPaymentIntent作成
  app/api/stripe/checkout/route.ts サブスクCheckout・顧客作成
  app/api/stripe/portal/route.ts   ビリングポータル
  app/api/stripe/webhook/route.ts  Webhook検証・正規化・分岐
```

---

## 料金プラン

```
Free:       0円  月15時間上限・広告あり
Standard:  750円  無制限・広告なし
Student:   250円  無制限・.ed.jp認証
Support+: 1,000円  高音質・応援ボーナス
```

### Studentプラン .ed.jp認証（v3.4第9章・Phase 3）

```
フロー：
  1. app/api/student/verify/request  school_email（.ed.jpドメイン必須）を受け取り、
     6桁コードを student_verifications に保存（有効期限10分）
  2. app/api/student/verify/confirm  コード確認（試行5回まで）→ users.student_verified = true
  3. 認証済みの場合のみ app/api/stripe/checkout で plan='student' のCheckoutを許可

未解決：メール配信基盤が未構築のため、確認コードの実際の送信経路は未実装
  （本番導入前に解決必須。SMS認証はSupabase Auth経由のため対象外・既存のまま維持）
```

---

## アーティスト登録・出金先銀行口座（Phase 0拡張）

```
RESON実装（既存のSMS認証フローに2ステップ追加。管理UIは作らずCRON_SECRET運用で統一）：
  artists.review_status text ('pending' | 'approved' | 'rejected') DEFAULT 'pending'
    アーティストアカウント自体の審査（本人確認相当。楽曲ごとの配信審査とは別物。
    楽曲単位の審査は下記「楽曲登録審査」節を参照）。
    既存アーティストはマイグレーション時点で 'approved' に移行済み（無審査運用してきたため）。
  artists.rights_confirmed bool / rights_confirmed_at timestamptz
    登録時に著作権・第三者権利侵害なし・銀行情報正確性のチェックボックス同意が必須（スキップ不可）。
  artist_bank_accounts（出金先銀行口座。本人名義一致の検証はUI上の注記のみ・自動検証は未実装）
    bank_name / branch_name / account_type('ordinary'|'checking') / account_number /
    account_holder_name。RLSは本人（artists.user_id）のみ読み書き可。

銀行口座情報の使われ方（明確化）：
  銀行APIとの自動連携は一切ない（実装されているのはDBへの保存のみ）。
  実際の資金移動は次の通り、すべて人力オペレーションで行われる：
    1. アーティストが出金申請（app/api/payout/request）→ payout_requests に pending で記録
    2. 運営担当者が CRON_SECRET 経由で app/api/payout/process を action='paid' で叩く
       → lib/payout/process.ts の processPayoutRequest が artist_bank_accounts を取得し、
         レスポンスに bank_account を含めて返す（担当者はこれを見て実際の銀行振込を手動で行う）
    3. artist_balances から出金額を減算（振込実行のトリガーではなく、システム側の記録更新のみ）
  アーティスト本人は app/api/artist/bank-account（GET/PATCH）でいつでも口座情報を確認・更新可能
  （GETは口座番号を末尾4桁以外マスクして返す）。ダッシュボードから編集フォームにアクセスできる。
  将来的に銀行振込APIとの連携（GMOあおぞらネット銀行API等）を行う場合はこの層を差し替える想定
  だが、現時点では未実装・調査もしていない。

登録フロー（app/(auth)/register/page.tsx）：
  phone → otp → artist（名前・bio） → bank（出金先銀行口座） → rights（権利確認・同意必須）→ done
  審査が承認されるまでアップロード自体は可能（配信開始＝公開のゲートではなく、登録ステータス
  の可視化のみ・実際の配信停止ロジックは未実装。Phase 4の人力審査ダッシュボードで本格運用予定）。

審査API：app/api/artist/review/route.ts（CRON_SECRET認証・POST { artist_id, action }）
  app/api/payout/process/route.ts と同じ「管理UIなし・bearer tokenで手動運用」パターンを採用。

ダッシュボード（app/(artist)/dashboard/page.tsx）：review_status が pending/rejected の場合に
  バナー表示。アルバム一覧も追加表示（/api/albums?mine=true）。
```

---

## 楽曲登録審査（配信代行サービスのフローを参考に追加。訂正: 「登録のプロセスを
配信代行サービスに近づける」という指示は、アーティスト登録ではなくこの楽曲登録の
フローを指していた）

```
参考にした実サービスのフロー（WebSearchで調査）：
  - TuneCore Japan：配信審査に通過するまで利用料は課金されない。
  - BIG UP!：楽曲・ジャケット登録を経て審査（人力・実例で数日）を通過してから配信開始。
    ジャケット画像の権利侵害が主な却下理由。

RESON実装（楽曲単位の審査。アーティスト登録自体の審査＝artists.review_status とは別軸）：
  tracks.review_status text ('pending' | 'approved' | 'rejected') DEFAULT 'pending'
    既存楽曲はマイグレーション時点で 'approved' に移行済み（無審査で配信してきたため）。
  tracks.reviewed_at timestamptz

アップロードは審査を待たずに可能（app/(artist)/upload）。ただし review_status = 'approved'
の楽曲のみが公開のリスナー向け一覧に現れる（審査中は実質「非公開アップロード」状態）：
  app/api/tracks/list/route.ts             .eq('review_status', 'approved')
  app/api/explore/route.ts                 同上
  lib/distribution/heat-candidates.ts      同上（熱量ランキング・おすすめの元データ）
  アーティスト自身のダッシュボード・レポート（app/api/artist/report）は review_status を
  問わず全楽曲を表示し、審査中/却下のバッジを出す（本人には常に見える）。

審査API：app/api/tracks/review/route.ts（CRON_SECRET認証・POST { track_id, action }）
  app/api/artist/review・app/api/payout/process と同じ「管理UIなし・bearer tokenで
  手動運用」パターンを採用。

楽曲ジャケット画像（BIG UP!等の必須項目に対応。任意項目として実装）：
  tracks.cover_r2_key（R2オブジェクトキー）。アップロードは音声ファイルと同じ
  署名付きURL方式（app/api/tracks/cover-upload-url、JPEG/PNG/WebPのみ許可）。
  表示は app/api/tracks/[trackId]/cover が署名付きGET URLへ302リダイレクト
  （音声ストリーミングと同じパターン）。app/(artist)/upload にアップロードUIを追加。
  アルバムに紐付けた楽曲はアルバム側のジャケット（albums.cover_r2_key）が使われる
  ため、このUIは album_id が未選択（＝シングル）の場合のみ表示する。

不正コンテンツの判定基準（何を審査するか）は運営の目視確認を前提とし、システム上の
  自動判定ロジックは持たない。
```

---

## シングル/EP/アルバムの区別・曲順・アルバム単位の再生（Phase 2）

```
albums.release_type（single/ep/album）：アルバム作成時に選択（app/(artist)/upload の
  アルバム新規作成フォーム）。デフォルトは'album'。/api/albums のGET/POSTで受け渡し。

tracks.track_number：アルバムに紐付けた楽曲の曲順（nullable・任意入力）。
  アップロード時（/api/tracks/upload-url）・編集時（PATCH /api/tracks/[trackId]）
  の両方でアルバム紐付けと同時に設定可能。album_idがnullの場合は常にnullへ強制。

アルバム単位の再生機能：
  API: app/api/albums/[albumId]/route.ts（GET・track_number順にソートした楽曲一覧
    + 合計再生時間を返す。review_status='approved'の楽曲のみ含む）
  UI: app/(player)/albums/page.tsx（?id=<albumId> のクエリパラメータで指定。
    静的エクスポート時にdynamicルートのgenerateStaticParams制約を避けるため、
    パスパラメータではなくクエリパラメータ方式を採用）
    既存の components/Player を再利用し、アルバム内の楽曲を順に連続再生できる
    （曲送りは既存のonEnded連鎖の仕組みをそのまま利用）。
  ダッシュボードのアルバム一覧（app/(artist)/dashboard）から遷移可能。

アルバムジャケット画像：
  albums.cover_r2_key（R2オブジェクトキー。既存のcover_url（外部URL直接指定）とは
  併存させ、cover_r2_keyがある場合はそちらを優先表示する）。
  アップロードは楽曲・楽曲ジャケットと同じ署名付きURL方式：
    app/api/albums/cover-upload-url（POST・アルバム所有アーティスト本人のみ）
    app/api/albums/[albumId]/cover（GET・署名付きURLへ302リダイレクト）
  UI: app/(artist)/upload のアルバム選択時に表示される専用アップロードUI
    （楽曲ジャケットとは別物。アルバム自体に紐づくため、楽曲アップロードとは
    非同期にいつでも設定・変更可能）。
  表示: app/(player)/albums（アルバム詳細）・app/(artist)/dashboard（一覧サムネイル）。
```

---

## ペアレンタル決済フロー（Phase 3・v3.4第9章）

```
既存の users.parent_user_id を実際に機能させる紐付けフロー。メール配信基盤が
未構築のため、承認リンクは本人（未成年リスナー）が保護者に直接共有する運用。

API:
  app/api/parental/request（POST）  子がトークン付き承認リクエストを作成
  app/api/parental/approve（POST）  保護者が自分のアカウントでログインした状態で
    トークンを渡して承認/却下 → 承認時に対象ユーザーの parent_user_id を更新
  app/api/parental/status（GET）    紐付け済みかどうか・保留中トークンを返す
UI:
  app/(player)/parental/page.tsx          子側：承認リンクの作成・共有
  app/(player)/parental/approve/page.tsx  保護者側：トークンを開いて承認/却下

決済への反映（app/api/stripe/checkout）：
  ユーザーに parent_user_id が設定されている場合、Stripe顧客（決済手段）は
  保護者側のものを使用/作成する。ただし checkout の metadata.supabase_user_id は
  本人（子）のままにし、webhook経由でプランが付与されるのは本人のアカウント。
  → 支払いは保護者のカードで行われるが、プランは子のアカウントに付与される。
  保護者の users レコード読み書きは RLS（本人のみ）を回避するため service role
  クライアントを使用（createServiceClient）。

未検証：Stripe側で「保護者のカードで子のプランを継続課金する」ことについての
  利用規約・カード会社側のポリシー上の懸念（本番導入前に確認が必要）。
```

---

## 支援者感謝ページ（Phase 2・「感謝を返せる設計」の一部）

```
アーティストが自分を応援してくれたリスナー（❤️・投げ銭・ブースト）を一覧できる
ページ。Support Graph（リスナー視点でフォロー中の人の応援を見る機能）とは逆方向の、
アーティスト視点での支援者一覧。

API: app/api/artist/supporters/route.ts（GET・本人のみ）
  自分の全楽曲に対する supports・boost_hearts を user_id 単位で集計し、
  ❤️回数・🚀回数・投げ銭合計額を算出。降順（🚀×30円 + 投げ銭合計）でソート。
UI: app/(artist)/supporters/page.tsx（ダッシュボードからリンク）

匿名リスナー（user_profiles未登録）は「名無しのリスナー」と表示。
個別のお礼メッセージ送信機能は未実装（一覧表示のみ）。
```

---

## アーティスト向け月次レポート（Phase 1・CLAUDE.mdディレクトリ構成で計画していたreport/を実装）

```
app/(artist)/report/page.tsx：/api/artist/report を再利用し、月選択タブ・各スコアの計算式
  ・プラン重み係数の注記・raw_score合成式・分配額の算出式・楽曲別の分配対象状況（100再生の
  閾値）を表示。「分配計算の計算式はパブリックページで常時公開」という実装ルールに対応する
  アーティスト本人向けの詳細ビュー（/dashboard は概要、/report は計算根拠の内訳に特化）。
  新規の月次通知（分配確定時にアーティストへ通知を送る仕組み）は未実装（既存のSNS通知機構
  との連携は今後の課題）。
```

---

## アーティスト出金ルール

```
最低出金額：1,000円
1,000円未満：翌月繰り越し（自動）
締め日：毎月末締め・翌月15日払い
累積50,000円超：出金申請を強制通知
2年間未出金：休眠口座として運営が保留（没収しない）
```

実装（最小実装・手動運用前提・管理UIなし）：
  app/api/payout/request/route.ts   アーティスト本人が申請（既存・最低1,000円・pending重複防止）
  app/api/payout/process/route.ts   管理者がpaid/rejectedを確定（CRON_SECRET認証・paid時にartist_balancesを減算）
  app/api/payout/batch/route.ts     月次バッチ（CRON_SECRET認証）：
    - checkBalanceNotifications：残高5万円超えで未通知（or 30日以上未通知）のアーティストへ通知
    - checkDormantAccounts：直近の出金（なければ残高発生時点）から2年以上経過したらdormant=trueに設定（没収はしない）
  lib/payout/rules.ts  純粋関数（shouldNotifyBalance / isDormant）・テスト済み

---

## 不正検知（閾値は非公開・コードにのみ記載）

```
検知種別（外部には種類のみ公開・閾値は非公開）：
  1. 同一ユーザー×同一楽曲×1時間以内に5回以上 → フラグ
  2. 同一IPから24時間以内に100再生以上 → フラグ
  3. 完聴率99%以上の連続再生が30回以上 → フラグ
  4. 再生間隔が±1秒以内の機械的パターンが10回以上 → フラグ

フラグ後の処置：
  level 1（警告）：分配計算から除外・アーティストへ通知
  level 2（停止）：楽曲を一時非公開・異議申し立て案内
  level 3（BAN）：全楽曲非公開・審査後に判定

実装状況（Phase 3で本格実装。lib/fraud/index.ts）：
  種別1（concentrated_plays）・種別3（abnormal_completion）は再生ログ受信時
    （app/api/tracks/[trackId]/play）に即時チェック（checkPlayEvent）。
  種別2（same_ip）・種別4（mechanical_pattern）はバッチで検知：
    play_events.ip_address カラムを追加し、再生ログ受信時にIPを記録
      （x-forwarded-for / x-real-ip ヘッダーから取得）。
    lib/fraud/index.ts の runFraudBatch(supabase) が直近24時間分の再生ログを
      IP単位・ユーザー単位に集計し、同一IP大量再生と再生間隔の機械的パターン
      （detectMechanicalPattern・純粋関数・テスト済み）を検知してフラグを立てる。
    app/api/fraud/run/route.ts（CRON_SECRET認証・POST）で手動/Cron実行。
  フラグの解除（resolved=true への更新）・level 2/3の実際の非公開化ロジックは
    未実装（人力審査ダッシュボードでの運用を想定・Phase 4の課題として持ち越し）。
```

---

## ディレクトリ構成

```
/
├── app/
│   ├── (auth)/              # ログイン・登録・SMS認証
│   ├── (player)/            # リスナー向けUI
│   │   ├── search/          # 文脈検索
│   │   └── explore/         # 探索モード
│   ├── (artist)/            # アーティスト向け
│   │   ├── dashboard/       # 収益・スコア確認
│   │   ├── upload/          # 楽曲アップロード
│   │   └── report/          # 月次レポート
│   ├── (admin)/             # 審査・管理
│   └── api/
│       ├── stripe/          # webhook（冪等実装必須）
│       ├── distribution/    # 分配計算API
│       ├── search/          # 文脈検索（Claude Haiku）
│       ├── fraud/           # 不正検知
│       └── payout/          # 出金処理
├── lib/
│   ├── supabase/            # client / server
│   ├── distribution/        # 分配計算ロジック（厚くテスト）
│   ├── search/              # LLM + pgvector
│   ├── audio/               # R2 + AcoustID
│   ├── fraud/               # 不正検知ロジック
│   └── payout/              # 出金ロジック
├── supabase/
│   └── migrations/
└── CLAUDE.md
```

---

## 実装フェーズ

- [x] **Phase 0**（1〜2ヶ月）基盤
  - [x] Supabase環境構築・スキーマ適用
  - [x] アーティスト登録フロー（SMS認証）
  - [x] 楽曲アップロード → R2保存 → 再生（Range Request対応）
  - [x] 基本プレイヤーUI
  - [x] Standard月額決済（PAY.JP or Stripe）

- [x] **Phase 1**（2〜4ヶ月）コア機能
  - [x] 応援ボタン（❤️）+ 投げ銭フロー
  - [x] 再生ログ記録（play_events・INSERTのみ）
  - [x] 熱量スコア月次バッチ
  - [x] 分配プール計算・artist_balances更新
  - [x] アーティスト月次レポート（計算式付き）
  - [x] AcoustID重複検知
  - [x] AI生成タグ強制付与フロー
  - [x] Support+月間蓄積投げ銭精算
  - [x] PaymentProvider抽象化レイヤー（Stripeアダプターのみ実装。他社決済は未実装・v3.4第3章）

- [ ] **Phase 2**（4〜6ヶ月）発見性
  - [ ] 文脈検索（Claude Haiku + pgvector）
  - [ ] Redisキャッシュ（LLMクエリ）
  - [x] 探索モード（再生数100〜5,000限定推薦）
  - [x] 熱量スコアベース推薦
  - [x] Support Graph（応援の連鎖表示。フォロー中ユーザーの応援を表示・詳細は上記節）
  - [x] 多層ジャンルタグ
  - [x] 紹介制（招待リンク・特典なし。Phase 4の「招待リクエスト機能」とは別物）
  - [x] SNSレイヤー基本機能（フォロー・投稿・コメント・いいね・通知。v3.4第9章）
  - [x] ジャンル別コミュニティ・ライブ情報・音楽人格・ブロック/通報（v3.4第9章。詳細は下記「SNS拡張機能」節）
  - [x] アルバム概念・ベストトラックランキング（Topster風プロフィール。詳細は下記「アルバム・Topster」節）
  - [x] ブーストハート🚀（月3回無料+課金20回・重み2倍・直接70%送金。v3.4第8章。週間伸び率ランキングは未実装）
  - [x] シングル/EP/アルバムの区別・曲順・アルバム単位の再生（詳細は上記節）
  - [x] 支援者感謝ページ（詳細は上記節）

- [ ] **Phase 3**（6〜8ヶ月）学生・決済拡張
  - [x] Studentプラン + .ed.jp認証（コード確認フローのみ実装。メール送信経路は未実装・要解決）
  - [ ] コンビニ払い（Stripe Konbini・30日前から審査申請）
  - [x] ペアレンタル決済フロー（トークン方式・詳細は上記節。本番導入前にStripe利用規約上の懸念を確認）
  - [ ] ギフトコード
  - [x] 出金処理・artist_balances管理（申請承認/却下・残高通知・休眠判定。管理UIはなし・CRON_SECRET認証のAPIのみ）
  - [x] 不正検知バッチ（同一IP・機械的パターンの再走査。詳細は上記「不正検知」節）

- [ ] **Phase 4**（8〜12ヶ月）エコノミー
  - [ ] キュレーターランク（先見性スコア）
  - [ ] 招待リクエスト機能
  - [ ] 創設アーティスト制度（バッジ・重み+0.2）
  - [ ] 人力審査ダッシュボード
  - [ ] 多通貨対応（DBは最初からcurrency付き）

---

## SNS拡張機能（v3.4第9章・Phase 2）

```
ジャンル別コミュニティ：
  既存の genres テーブルを再利用（新規タクソノミーは作らない）。
  community_members (user_id, genre_id) で参加状況を管理。
  posts.genre_id を追加し、既存の /api/posts をそのままコミュニティ専用フィードとして
  利用（?genre_id= クエリで絞り込み）。
  API: app/api/communities/route.ts（GET一覧/参加状況・POST参加・DELETE離脱）
  UI:  app/(player)/communities/page.tsx → 参加ボタン・「フィードへ」リンク

ライブ情報（Event）：
  events（アーティスト所有・タイトル/日時/場所/チケットURL）
  event_attendees（interested / going のRSVP・本人のみ登録解除）
  API: app/api/events/route.ts（GET一覧・POST作成＝アーティスト本人のみ）
       app/api/events/[eventId]/attend/route.ts（POST/DELETE）
  UI:  app/(player)/events/page.tsx

音楽人格（UserProfile）：
  user_profiles（display_name / bio / persona_tags[] / avatar_url）
  MVPはユーザー自己申告のタグ編集のみ。聴取データ（play_events）からの
  自動算出は未実装（Phase 4以降の課題として持ち越し）。
  API: app/api/profile/route.ts（GET自分or?user_id=他人・PATCH自分のみ）
  UI:  app/(player)/profile/page.tsx

ブロック/通報：
  blocks は一方向で保存（blocker_id視点のみ・RLSでブロックした側のみ参照可）。
  フォロー・コメントへの影響は lib/sns/blocks.ts の isBlockedEitherWay() で
  双方向にAPI層で抑制（app/api/follows, app/api/posts/[postId]/comments,
  app/api/posts のフィード除外に適用）。
  isBlockedEitherWay() はUUID形式を正規表現で検証してから .or() フィルタに
  埋め込む（フィルタ構文インジェクション対策）。
  reports は保存のみ（status: pending/reviewed/dismissed）。人力審査ダッシュ
  ボードは未実装（(admin) は空ディレクトリのまま）。status更新はservice role経由
  のみ想定。
  API: app/api/blocks/route.ts（GET/POST/DELETE。ブロック時に双方向フォローを解除）
       app/api/reports/route.ts（POST。target_type: post/comment/user/artist）
  UI:  app/(player)/feed/page.tsx の投稿カードに「⋯」メニュー（報告する/ブロックする）

RLS：supabase/migrations/20260016_community_event_profile_safety.sql に
  community_members / events / event_attendees / user_profiles / blocks /
  reports の全テーブルのRLSを定義（公開読み取り系は public_read、
  本人操作系は auth.uid() 比較）。
```

---

## アルバム・Topster（Phase 2）

```
アルバム：
  albums（アーティスト本人が任意で作成）。tracks.album_id で楽曲を紐付ける（nullable・
  未紐付けはシングル扱い）。
  API: app/api/albums/route.ts（GET一覧・?artist_id= or ?mine=true・POST作成＝アーティスト本人のみ）
       app/api/tracks/[trackId]/route.ts（PATCH album_id＝楽曲の所有アーティスト本人のみ。
       アルバムも同一アーティスト所有であることを確認）
       app/api/tracks/upload-url/route.ts はアップロード時にも album_id を任意で受け付ける
  UI:  app/(artist)/upload/page.tsx にアルバム選択/新規作成フォームを追加

ベストトラックランキング（Topster風プロフィール）：
  best_tracks（user_id, rank 1-10, track_id）。アルバム単位ではなく楽曲単位でランクインする
  自己申告のお気に入りランキング（聴取データからの自動算出ではない）。
  API: app/api/best-tracks/route.ts（GET自分or?user_id=他人・PUT＝track_ids配列で全件入れ替え）
  UI:  app/(player)/profile/page.tsx に楽曲検索→追加→並べ替え（▲▼）→保存のUIを追加
  app/api/tracks/list は ?q= でのタイトル検索に対応（Topsterの楽曲検索用）
```

---

## 実装ルール（必読）

1. **`lib/distribution/` は完全に分離** → テストなしでマージしない
2. **`play_events` はINSERTのみ** → UPDATEしない。分配根拠ログを改ざん不可に保つ
3. **Claude APIはHaikuのみ** → Sonnet以上はコスト制御のため使わない
4. **Stripeのwebhookは冪等に実装** → 重複処理でDB不整合を起こさない
5. **R2への直アクセスは署名付きURL経由のみ** → 音声ファイルを直公開しない
6. **不正検知の閾値はコードにのみ記載** → 外部公開しない（セキュリティ上の理由）
7. **分配計算の計算式はパブリックページで常時公開** → 閾値以外はすべて透明

---

## 環境変数（`.env.local`）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 決済（PAY.JP or Stripe・どちらか選択）
PAYJP_SECRET_KEY=
PAYJP_PUBLIC_KEY=
PAYJP_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STANDARD=
STRIPE_PRICE_STUDENT=
STRIPE_PRICE_SUPPORT_PLUS=

# Cloudflare R2
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=

# Upstash Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Claude API（Haikuのみ使用）
ANTHROPIC_API_KEY=
```

---

## 未解決・要確認事項（実装前に調査必要）

| # | 課題 | 優先度 | 実装上の影響 |
|---|---|---|---|
| 1 | PAY.JPの最低手数料の有無 | 高 | Studentプランの赤字リスク |
| 2 | Stripe Konbini審査（30日前に申請） | 高 | Phase 3のタイムライン |
| 3 | 独自ウォレット方式の資金決済法適否 | 中 | Phase 4の投げ銭設計 |
| 4 | サービス名の決定 | 高 | ドメイン・ブランディング |
| 5 | JASRAC包括契約（弁護士） | 高 | Phase 3以降のカタログ |
| 6 | 未成年アーティストの親権者同意フロー（自己申告制の最小実装は完了。実在確認は未実装） | 中 | Phase 0の登録設計 |
| 7 | AcoustIDの利用規約・商用利用条件 | 中 | Phase 1の審査フロー |
| 8 | メール配信基盤の選定（.ed.jp確認コード送信用） | 高 | Studentプラン認証フローの本番稼働 |

---

## 詳細仕様の参照先

章ごとに詳細が必要な場合は仕様書（サービス仕様書_v2.2.docx）を参照：

- 分配・透明性 → 第3〜4章
- AI生成対策 → 第5章
- 発見性設計 → 第6章
- アーティスト登録審査 → 第8章
- 中高生決済 → 第9章
- 文脈LLM検索 → 第10章
- ライセンス法務 → 第13章
- 出金設計 → 第14章
- 不正検知 → 第15章
