-- Enable pgvector for future semantic search
create extension if not exists vector;

-- ユーザー
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  plan text not null default 'free' check (plan in ('free','standard','student','support_plus')),
  student_verified bool not null default false,
  parent_user_id uuid references users(id),
  currency text not null default 'JPY',
  created_at timestamptz not null default now()
);

-- アーティスト
create table artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  name text not null,
  bio text,
  verified_badge bool not null default false,
  founding_artist bool not null default false,
  created_at timestamptz not null default now()
);

-- 楽曲
create table tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  title text not null,
  duration_sec int not null,
  r2_key text not null,
  fingerprint text,
  ai_generated bool not null default false,
  cumulative_plays int not null default 0,
  in_distribution bool not null default false,
  registration_fee_paid bool not null default false,
  created_at timestamptz not null default now()
);

-- 共同楽曲の分配設定
create table track_splits (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  artist_id uuid not null references artists(id),
  split_pct numeric not null check (split_pct > 0 and split_pct <= 100),
  agreed bool not null default false
);

-- 再生ログ（INSERTのみ・UPDATE禁止）
create table play_events (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  user_id uuid not null references users(id),
  user_plan text not null,
  played_sec int not null,
  duration_sec int not null,
  completed bool not null default false,
  weight numeric not null,
  sec_factor numeric not null,
  created_at timestamptz not null default now()
);

-- 応援（❤️ + 投げ銭）
create table supports (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  user_id uuid not null references users(id),
  amount_yen int not null default 0,
  payment_id text,
  created_at timestamptz not null default now()
);

-- 月次分配
create table monthly_distributions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  year_month text not null,
  total_pool_yen numeric not null,
  artist_share_ratio numeric not null,
  distribution_yen numeric not null,
  score_breakdown jsonb not null default '{}',
  tips_yen numeric not null default 0,
  paid_at timestamptz
);

-- アーティスト残高
create table artist_balances (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references artists(id),
  balance_yen numeric not null default 0,
  last_notified_at timestamptz,
  dormant bool not null default false,
  updated_at timestamptz not null default now()
);

-- Support+投げ銭の月間蓄積
create table support_plus_tip_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  year_month text not null,
  total_tips_yen numeric not null,
  stripe_fee_yen int not null,
  net_yen numeric not null,
  processed bool not null default false
);

-- 不正検知フラグ
create table fraud_flags (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  user_id uuid not null references users(id),
  flag_type text not null check (
    flag_type in ('concentrated_plays','same_ip','mechanical_pattern','abnormal_completion')
  ),
  level int not null check (level in (1, 2, 3)),
  resolved bool not null default false,
  created_at timestamptz not null default now()
);
