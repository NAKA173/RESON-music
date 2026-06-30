-- ブーストハート🚀（応援表明の多層化・第8章）
-- 月3回まで無料・以降1回30円で月23回まで購入可能。応援度スコアへの重みは2倍。

create table boost_hearts (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  user_id uuid not null references users(id),
  year_month text not null, -- "2026-07"
  amount_yen int not null default 0 check (amount_yen in (0, 30)),
  payment_id text,
  created_at timestamptz not null default now()
);
create index idx_boost_hearts_user_month on boost_hearts(user_id, year_month);
create index idx_boost_hearts_track on boost_hearts(track_id);

alter table boost_hearts enable row level security;

-- 無料ブーストは本人が直接INSERT。有料ブーストはStripe webhook（service role）経由でINSERT
create policy "boost_hearts_user_insert" on boost_hearts for insert with check (
  auth.uid() = user_id
);
create policy "boost_hearts_user_read" on boost_hearts for select using (
  auth.uid() = user_id
);
