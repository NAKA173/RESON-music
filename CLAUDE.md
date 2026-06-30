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

-- アーティスト
artists (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  name text,
  bio text,
  verified_badge bool DEFAULT false,  -- 初回審査通過
  founding_artist bool DEFAULT false, -- 創設アーティスト
  created_at timestamptz
)

-- 楽曲
tracks (
  id uuid PK,
  artist_id uuid REFERENCES artists(id),
  title text,
  duration_sec int,
  r2_key text,             -- Cloudflare R2のオブジェクトキー
  fingerprint text,        -- AcoustID
  ai_generated bool DEFAULT false,
  cumulative_plays int DEFAULT 0,
  in_distribution bool DEFAULT false,  -- 100再生超えたらtrue
  registration_fee_paid bool DEFAULT false,
  created_at timestamptz
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
  support_rate       = COUNT(supports) / COUNT(play_events) WHERE sec_factor > 0
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

## 料金プラン

```
Free:       0円  月15時間上限・広告あり
Standard:  750円  無制限・広告なし
Student:   250円  無制限・.ed.jp認証
Support+: 1,000円  高音質・応援ボーナス
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

- [ ] **Phase 2**（4〜6ヶ月）発見性
  - [ ] 文脈検索（Claude Haiku + pgvector）
  - [ ] Redisキャッシュ（LLMクエリ）
  - [x] 探索モード（再生数100〜5,000限定推薦）
  - [x] 熱量スコアベース推薦
  - [ ] Support Graph（応援の連鎖表示）
  - [x] 多層ジャンルタグ
  - [x] 紹介制（招待リンク・特典なし。Phase 4の「招待リクエスト機能」とは別物）
  - [x] SNSレイヤー基本機能（フォロー・投稿・コメント・いいね・通知。v3.4第9章。コミュニティ・ライブ情報・音楽人格は未実装）

- [ ] **Phase 3**（6〜8ヶ月）学生・決済拡張
  - [ ] Studentプラン + .ed.jp認証
  - [ ] コンビニ払い（Stripe Konbini・30日前から審査申請）
  - [ ] ペアレンタル決済フロー
  - [ ] ギフトコード
  - [ ] 出金処理・artist_balances管理
  - [ ] 不正検知バッチ

- [ ] **Phase 4**（8〜12ヶ月）エコノミー
  - [ ] キュレーターランク（先見性スコア）
  - [ ] 招待リクエスト機能
  - [ ] 創設アーティスト制度（バッジ・重み+0.2）
  - [ ] 人力審査ダッシュボード
  - [ ] 多通貨対応（DBは最初からcurrency付き）

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
| 6 | 未成年アーティストの親権者同意フロー | 高 | Phase 0の登録設計 |
| 7 | AcoustIDの利用規約・商用利用条件 | 中 | Phase 1の審査フロー |

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
