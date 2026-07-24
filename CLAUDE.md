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
  is_admin bool DEFAULT false,               -- 人力審査ダッシュボードの権限判定
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
  isrc text,               -- 国際標準レコーディングコード（任意・自己申告制）
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

-- 自由な曲数のプレイリスト（best_tracksとは別物・上限なし）
playlists (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  title text,
  is_public bool DEFAULT true,
  created_at timestamptz, updated_at timestamptz
)
playlist_tracks (
  id uuid PK,
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE,
  track_id uuid REFERENCES tracks(id),
  position int,
  added_at timestamptz,
  UNIQUE (playlist_id, track_id)
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

週間ブーストランキング（絶対数ではなく先週比の伸び率ベース。累計再生数500未満の楽曲は対象外）：
  lib/boost/ranking.ts の computeGrowthRate(thisWeek, lastWeek) - 純粋関数（テスト済み）。
  前週ゼロ件でもゼロ除算せず「今週の伸び」を評価できるよう thisWeek / (lastWeek + 1) で算出。
  API: app/api/boost/weekly-ranking（GET・公開）
  UI: app/(player)/boost-ranking/page.tsx
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

メール配信：lib/email.ts の sendEmail()（Resend API）。RESEND_API_KEY未設定の環境
  （ローカル/テスト）では送信をスキップしコンソール出力のみに留める設計（決済系の
  PaymentProviderと同じ「未設定時はno-op」パターン）。本番ではRESEND_API_KEY /
  RESEND_FROM_EMAIL の設定が必要（SMS認証はSupabase Auth経由のため対象外・既存のまま維持）。
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

## 開発者用ログイン（電話番号SMS認証のバイパス・開発/検証専用）

```
発覚した問題：SupabaseのSMSプロバイダ（Twilio等）が未設定/不調な環境では、
  電話番号OTP認証フロー自体が機能せず登録・ログインができない。よくある原因：
    - SupabaseダッシュボードでSMSプロバイダ（Twilio/MessageBird等）が未設定
    - Twilioトライアルアカウントで未検証の番号に送信しようとしている
    - 電話番号の形式が国際番号形式（+81...）になっていない
    - Supabase Authの電話認証機能自体がプロジェクトで無効化されている
  上記はSupabaseダッシュボード側の設定確認が必要（コード側の問題ではない）。

緊急避難として、電話番号を使わないメール+パスワードでの開発者用ログインを追加：
  app/api/dev/seed-account（POST・CRON_SECRET認証）
    { email, password } を受け取り、Supabase Auth ユーザーを
    auth.admin.createUser()（email_confirm: true）で作成（べき等・既存なら
    パスワードを更新）。あわせて users（plan='support_plus', is_admin=true）・
    artists（review_status='approved'）・artist_bank_accountsをダミー値で作成し、
    プレミアム機能・アーティスト機能・管理ダッシュボードをすぐ試せる状態にする。
  app/(auth)/dev-login/page.tsx（GET）
    lib/supabase/client.ts のブラウザクライアントで signInWithPassword() を実行する
    シンプルなログインフォーム。

本番運用では使わない想定（CRON_SECRETを知らない限り誰も新規作成できないため実害は
  限定的だが、電話番号認証が正常に動く環境では不要な迂回路であることに留意）。
```

---

## ISRC（国際標準レコーディングコード）

```
配信代行サービス（TuneCore Japan等）と同様、ISRCは自己申告制の任意項目として導入。
RESON側でISRC発行機関に登録して新規コードを発行する機能は持たない（登録者コードの
取得には各国のISRC発行機関への申請が必要で本サービスの範囲外）。既にISRCを取得済みの
アーティストが入力できる、という位置づけ。

lib/isrc.ts:
  normalizeIsrc(input) - ハイフン・空白を除去し大文字化した正規形（12文字）に変換
  isValidIsrc(normalized) - CC-XXX-YY-NNNNN形式かを判定する純粋関数（テスト済み）
  formatIsrc(normalized) - 表示用にハイフン区切りへ整形

tracks.isrc text（nullable）。DB側でも形式チェック制約 + NULLを除く一意インデックス
  （idx_tracks_isrc_unique）を設定し、アプリ層のバリデーションと二重に保証する。
  重複時は409を返す（fingerprint/AcoustIDの重複検知と同じ「未入力可・重複のみ検知」方針）。

入力: app/(artist)/upload（新規アップロード時・任意）
     app/api/tracks/[trackId]（PATCH { isrc }・本人のみ・後からの追加/修正も可能）
表示: app/(artist)/dashboard の楽曲リストに表示（本人のみ。公開ページには未反映）
```

---

## 重複検知（フィンガープリント）— β版緊急対応で実装

```
発覚した問題：lib/audio/fingerprint.ts（サーバー側のAcoustID照合・DB内重複チェック）は
  完成していたが、クライアント側でフィンガープリントを生成・送信する処理が
  「fpcalc WASMは別途統合」というコメントのまま放置されており、実際には一度も
  呼び出されていなかった（重複楽曲がノーチェックで配信されてしまう状態）。

対応（簡易実装。真のChromaprint互換ではないことを明記）：
  lib/audio/client-fingerprint.ts の computeClientFingerprint(file) - ブラウザの
    Web Audio API（decodeAudioData）で音声をデコードし、ラウドネス（RMS）の
    エンベロープを512点抽出→最大値で正規化・量子化→SHA-256でハッシュ化した文字列を
    返す。ChromaprintのようなAcoustID互換のクロマ特徴量ではないため、AcoustID側の
    外部データベース（MusicBrainz）とのマッチングは機能しない
    （lib/audio/fingerprint.ts の lookupFingerprint は呼ばれるがほぼ常に不一致になる）。
    目的はRESON内の完全一致・ほぼ一致の重複アップロードを検知することに限定する。
  デコードに失敗した場合は null を返し、フィンガープリント生成をスキップする
    （重複検知が効かなくなるだけで、アップロード自体は継続させる・安全側に倒す）。

app/(artist)/upload/page.tsx：アップロード完了後にフィンガープリントを計算し
  POST /api/tracks/fingerprint に送信する。409（重複）が返った場合は警告バナーを表示し、
  ダッシュボードへの遷移を4秒遅らせて警告を読めるようにする（審査時に人力で確認する
  想定・自動でのアップロード拒否は行わない）。

将来的にChromaprint WASMを統合すれば、この層を差し替えるだけでAcoustID外部照合
  （MusicBrainzのメタデータ取得）も機能するようになる設計にしている。
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

## プレイヤー機能拡張（既存音楽サブスクとの機能ギャップ対応）

```
自由な曲数のプレイリスト（ベストトラックランキング＝Topster風・上限10曲とは別物）：
  playlists（user_id, title, is_public）/ playlist_tracks（playlist_id, track_id, position）
  RLS: is_public=trueは誰でも読める・編集は本人のみ。
  API: app/api/playlists（GET一覧/POST作成）
       app/api/playlists/[playlistId]（GET詳細+is_owner・PATCH・DELETE）
       app/api/playlists/[playlistId]/tracks（POST追加・PUT並べ替え=全件入れ替え・DELETE削除）
  UI: app/(player)/playlists（一覧+作成）
      app/(player)/playlists/detail（?id=クエリ方式。楽曲検索→追加・▲▼並べ替え・削除）

キュー再生・シャッフル・リピート（lib/player/queue.ts の usePlayerQueue フックに集約）：
  ページ側（ホーム・アルバム詳細・プレイリスト詳細・ライブラリ）が曲リストを持ち、
  このフックが「今どれを再生するか」を管理する（キュー優先 → シャッフル順 or 順番 → リピート）。
  repeatMode: 'off' | 'all' | 'one'。shuffleOnはトグル時にFisher-Yatesで順序を再生成。
  addToQueue()で曲を「次に再生」キューに追加（各一覧の「+キュー」ボタンから）。
  components/Player.tsx の controls props で ⏮⏭🔀🔁 ボタンを表示（controls未指定なら非表示のまま）。

ギャップレス再生（近似実装。真のサンプル精度ギャップレスではない）：
  次に再生する曲のstream URLを隠しaudio要素で先読み（preload="auto"）し、
  ブラウザのHTTPキャッシュを温めることで曲送り時の無音区間を短縮する。

音量ノーマライズ（簡易実装。EBU R128等の厳密なラウドネス測定は行わない）：
  Web Audio API（AudioContext + DynamicsCompressorNode）で再生中の音声にゆるやかな
  コンプレッションをかけ、曲間の音量差を緩和する。ボタンでON/OFF切替（localStorageに保存）。
  R2バケットのCORS設定がcreateMediaElementSourceを許可していない場合は例外を捕捉し、
  通常再生を継続する（ノーマライズ機能のみ無効化）。

新曲リリース通知：
  notifications.type='new_track' は既存だったが発火箇所がなかった。
  app/api/tracks/review（審査承認時）で、対象アーティストをフォローしているユーザー全員に
  createNotification()を呼ぶよう追加。
  app/(player)/notifications/page.tsx（通知一覧・既存の/api/notificationsを利用。
  これまで一覧表示するUIが存在しなかった）。

いいね集約（マイライブラリ）：
  ❤️応援ボタン（supports.amount_yen=0）でハートした曲を集約する。
  SNS用の汎用likesテーブル（posts/artists等への「いいね」）とは別物。
  API: app/api/library/liked-tracks（GET・本人のみ）
  UI: app/(player)/library/page.tsx

未実装：音質選択（ビットレート切替）
  現状はアップロードされた音声ファイルをそのまま配信しており、複数ビットレートへの
  トランスコードパイプライン（ffmpeg等）が存在しないため、選択可能な音質は1種類のみ。
  実装するには、アップロード時に複数ビットレートへ変換してR2に保存する処理が別途必要。

ライト/ダークモード切替：
  CSS変数（app/globals.css）で :root[data-theme="light"] にライト用の値を定義し、
  <html>要素のdata-theme属性で切り替える。localStorage（reson_theme）に保存し、
  app/layout.tsx のheadに埋め込んだ同期スクリプトで描画前に適用する
  （切り替え時のフラッシュ防止。React hydrationより前に実行する必要があるため
  dangerouslySetInnerHTMLの生スクリプトを使用）。
  components/ThemeToggle.tsx（ホーム画面トップバー・設定ページに配置）。
  既知の制約：ダッシュボード・アップロード・登録・レポート等のアーティスト向け
  ページはCSS変数化されておらずbg-black等を直接指定しているため、このトグルは
  リスナー向けページ（ホーム・探索・フィード・アルバム・プレイリスト等）にのみ
  反映される。全ページのCSS変数化は別途の対応が必要。

歌詞表示・入力：
  tracks.lyrics text（nullable・最大10000文字）。
  入力: app/api/tracks/[trackId]（PATCH { lyrics }・本人のみ）。
    app/(artist)/dashboard の楽曲リストから「歌詞」リンクでインライン編集。
  表示: app/api/tracks/[trackId]/lyrics（GET・誰でも閲覧可）。
    components/Player.tsx に「📝 歌詞」トグルを追加し、クリック時に遅延取得する
    （曲一覧のレスポンスに歌詞本文を含めない設計。長文になり得るため）。

年間まとめ（Wrapped的な振り返り）：
  play_events を年単位で集計するのみで新規テーブルは不要。
  API: app/api/wrapped?year=YYYY（GET・本人のみ）
    合計再生時間・再生回数・完聴数・よく聴いたアーティスト/楽曲トップ10を算出。
  UI: app/(player)/wrapped/page.tsx（年切替タブ付き）
```

---

## キュレーターランク（先見性スコア・Phase 4）

```
「まだ無名だった楽曲を早く見つけて応援した」リスナーに加点する仕組み。
supports.track_plays_at_support（応援した時点のtracks.cumulative_playsのスナップ
ショット）を新設し、後からその楽曲が伸びたかどうかを判定できるようにした。

lib/curator/index.ts:
  computeCuratorPoints(playsAtSupport) - 純粋関数（テスト済み）。100再生未満での
    応援ほど加点が大きい（0再生時点=10点、閾値以上=0点）。閾値は不正検知の閾値と
    異なり非公開にする必要はないため、コード内の定数として公開している。
  runCuratorBatch(supabase) - counted_for_curator=falseの応援のうち、対象楽曲が
    SUCCESS_THRESHOLD（500再生）に達したものだけを集計してcurator_scoresに加点する。
    まだ伸びていない曲の応援はカウント済みフラグを立てず、次回以降のバッチで再評価する。

API:
  app/api/curator/run（CRON_SECRET認証。app/api/distribution/run内でも同時実行）
  app/api/curator/leaderboard（GET・公開）
UI: app/(player)/curators/page.tsx（ランキング一覧）
```

---

## 人力審査ダッシュボード（Phase 4）

```
これまで「管理UIは作らずCRON_SECRET運用で統一」という方針だったが、実際に
ブラウザから審査業務を行うためのダッシュボードを新設した（CRON_SECRET運用の
バッチAPIは自動化用として並存させる）。

users.is_admin bool DEFAULT false を新設。管理者ロールの判定はこのフラグのみで、
別途の管理者専用ログインフローは作らず、既存のSupabase Auth（電話番号OTP）で
ログイン済みのユーザーがis_admin=trueであればダッシュボードを利用できる。
is_adminをtrueにする操作自体はDB直接操作のみ（UIからの権限昇格経路は存在しない）。

lib/admin/auth.ts: requireAdmin() - セッションユーザーがis_admin=trueか判定する。
  実際のデータ読み書きはservice role client（RLSをバイパス）で行う
  （fraud_flags・reports・payout_requestsはRLSが本人限定/service role限定のため、
  通常のクライアントでは管理者でも読み書きできない）。

API（app/api/admin/以下。すべてrequireAdmin()でガード）：
  artists・artists/review    アーティスト登録審査（既存のapp/api/artist/reviewと同等）
  tracks・tracks/review      楽曲配信審査。lib/moderation/tracks.ts の reviewTrack()
                              を既存のapp/api/tracks/reviewと共有し、承認時の新曲通知
                              ロジックが分岐しないようにしている
  fraud-flags・fraud-flags/resolve  不正検知フラグの解決
  reports・reports/resolve   SNS通報のトリアージ（reviewed/dismissed）
  payouts・payouts/process   出金申請（lib/payout/process.ts のprocessPayoutRequestを共有）

UI: app/(admin)/admin/page.tsx（タブ切り替え：アーティスト審査/楽曲審査/不正検知/
  通報/出金申請）。/api/admin/me で is_admin を確認できない場合は「権限がありません」
  と表示するのみ（リダイレクトはしない・最小実装）。
```

---

## ダイレクトメッセージ（SNS系機能の充実・Phase 2拡張）

```
1:1のダイレクトメッセージ。既存のposts/comments（公開の投稿・コメント）とは別に、
非公開のユーザー間コミュニケーション手段を追加した。

direct_messages（sender_id, recipient_id, body, read_at）。RLSは送信者・受信者
本人のみ読める。送信はlib/sns/blocks.tsのisBlockedEitherWay()でブロック関係を
チェックしてから許可する（既存のfollows/commentsと同じ抑制パターン）。

notifications.type に 'message' を追加（既存のcheck制約を更新するマイグレーション）。

API:
  app/api/messages（GET ?with=<user_id> スレッド取得+既読化・POST送信）
  app/api/messages/conversations（GET 会話一覧・最新メッセージのプレビュー付き）
  app/api/users/search（GET ?q= display_name部分一致検索。新規会話開始用）
UI: app/(player)/messages/page.tsx（?with=<user_id>クエリ方式。会話一覧+スレッド表示）

楽曲の貼付（投稿・DM共通の「紹介」機能）：
  direct_messages.track_id を追加（postsは既存のtrack_idで対応済み）。本文と楽曲添付は
  どちらか一方があればよい（本文のみ・楽曲のみ・両方、いずれも送信可能）。
  フィード投稿の作成フォーム（app/(player)/feed）・DM送信フォーム（app/(player)/messages）
  の両方に楽曲検索（/api/tracks/list?q=）→選択の同じUIパターンを実装。
  貼付された楽曲は app/(player)/track（?id=<track_id>クエリ方式・新設の単曲再生ページ。
  既存のcomponents/Playerを再利用し❤️・投げ銭・ブースト・歌詞もそのまま利用できる）への
  リンクとして表示される。
```

---

## 創設アーティスト制度（バッジのみ・Phase 4）

```
artists.founding_artist は既存カラムだったが、これを見る/更新するコードが一切なく
死んだフィールドだった。今回は指示に従い「バッジのみ」実装し、分配重み+0.2への反映は
見送る（別途の指示があるまで着手しない）。

付与/解除：管理UI（app/(admin)/admin/page.tsx の「創設アーティスト」タブ）から
  アーティスト名で検索してトグルする。app/api/admin/artists/search（検索）・
  app/api/admin/artists/founding（付与/解除）。is_adminのみ操作可能。

バッジ表示：★アイコンで以下に反映
  app/(artist)/dashboard（本人のダッシュボードヘッダー）
  app/(player)/feed（投稿者がアーティストの場合の投稿カード）
  app/(player)/track（楽曲詳細ページのアーティスト名）
  ホーム画面（app/(player)/home）の「注目のアーティスト」セクションは既存のハード
  コードされたモックデータのままで、実データ（founding_artist）への接続は未対応
  （既知の制約・別途対応が必要）。
```

---

## アーティスト向け月次レポート（Phase 1・CLAUDE.mdディレクトリ構成で計画していたreport/を実装）

```
app/(artist)/report/page.tsx：/api/artist/report を再利用し、月選択タブ・各スコアの計算式
  ・プラン重み係数の注記・raw_score合成式・分配額の算出式・楽曲別の分配対象状況（100再生の
  閾値）を表示。「分配計算の計算式はパブリックページで常時公開」という実装ルールに対応する
  アーティスト本人向けの詳細ビュー（/dashboard は概要、/report は計算根拠の内訳に特化）。
  月次通知：notifications.type='monthly_report' を追加し、lib/distribution/batch.ts の
  runMonthlyDistribution 内で distribution_yen > 0 のアーティストへ確定時に送信する
  （既存のSNS通知機構=createNotification()をそのまま再利用）。
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
  level 2（停止）の非公開化：tracks.fraud_suspended bool を追加し、raiseFlag()が
    level=2のフラグを立てた瞬間に対象楽曲を自動でfraud_suspended=trueにする。
    公開のリスナー向け一覧（tracks/list, explore, heat-candidates）は
    fraud_suspended=falseのみ表示する（review_status='approved'条件と併用）。
    level 3（BAN）は自動化せず人力審査後の判断のままとする（仕様通り）。
  フラグの解除・配信再開：人力審査ダッシュボード（app/(admin)/admin/page.tsx）の
    「不正検知」タブから resolved=true への更新、および配信停止中の楽曲は
    「解決して配信を再開」ボタンでfraud_suspended=falseに戻せる
    （app/api/admin/fraud-flags/resolve）。
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
  - [x] AcoustID重複検知（簡易フィンガープリント。詳細は下記「重複検知（フィンガープリント）」節）
  - [x] AI生成タグ強制付与フロー
  - [x] Support+月間蓄積投げ銭精算
  - [x] PaymentProvider抽象化レイヤー（Stripeアダプターのみ実装。他社決済は未実装・v3.4第3章）

- [ ] **Phase 2**（4〜6ヶ月）発見性
  - [ ] 文脈検索（Claude Haiku + pgvector）。app/(player)/search は「準備中」の
        プレースホルダー表示のみ実装済み（ナビのリンク先が空で404/白画面になる問題への対応）
  - [x] Redisキャッシュの基盤（lib/cache.ts）を先行実装。文脈検索が未実装のため
        まだどこからも呼ばれていない（UPSTASH_REDIS_URL/TOKEN未設定時は常にミスとして
        動作する no-op 設計。文脈検索実装時に withCache() でラップする想定）
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
  - [x] Studentプラン + .ed.jp認証（メール送信はResend経由。RESEND_API_KEY未設定時はno-op）
  - [ ] コンビニ払い（Stripe Konbini・30日前から審査申請）
  - [x] ペアレンタル決済フロー（トークン方式・詳細は上記節。本番導入前にStripe利用規約上の懸念を確認）
  - [ ] ギフトコード
  - [x] 出金処理・artist_balances管理（申請承認/却下・残高通知・休眠判定。管理UIはなし・CRON_SECRET認証のAPIのみ）
  - [x] 不正検知バッチ（同一IP・機械的パターンの再走査。詳細は上記「不正検知」節）

- [ ] **Phase 4**（8〜12ヶ月）エコノミー
  - [x] キュレーターランク（先見性スコア。詳細は上記節）
  - [ ] 招待リクエスト機能
  - [x] 創設アーティスト制度（バッジのみ実装。分配重み+0.2は未実装・詳細は下記節）
  - [x] 人力審査ダッシュボード（詳細は上記節）
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
  persona_tags自体は自己申告制のまま維持し、聴取データ（play_events × track_genres）
  から上位5ジャンルを「提案タグ」として算出しユーザーが選んで追加できるようにした
  （自動で上書き・強制はしない）。
  API: app/api/profile/route.ts（GET自分or?user_id=他人・PATCH自分のみ）
       app/api/profile/suggested-tags（GET・本人のみ。sec_factor>0の再生を重み付け集計）
  UI:  app/(player)/profile/page.tsx（提案タグをチップ表示・クリックで追加）

ブロック/通報：
  blocks は一方向で保存（blocker_id視点のみ・RLSでブロックした側のみ参照可）。
  フォロー・コメントへの影響は lib/sns/blocks.ts の isBlockedEitherWay() で
  双方向にAPI層で抑制（app/api/follows, app/api/posts/[postId]/comments,
  app/api/posts のフィード除外に適用）。
  isBlockedEitherWay() はUUID形式を正規表現で検証してから .or() フィルタに
  埋め込む（フィルタ構文インジェクション対策）。
  reports は保存のみ（status: pending/reviewed/dismissed）。トリアージは
  人力審査ダッシュボード（app/(admin)/admin/page.tsx）から行う（詳細は上記
  「人力審査ダッシュボード」節）。status更新はservice role経由のみ。
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
| 8 | メール配信基盤（Resend採用・実装済み。本番用のRESEND_API_KEY発行が残課題） | 低 | Studentプラン認証フローの本番稼働 |

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
