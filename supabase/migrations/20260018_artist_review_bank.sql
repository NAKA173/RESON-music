-- アーティスト登録フローの拡張：審査ステータス・権利確認・銀行口座情報
-- 配信代行サービス（TuneCore Japan / BIG UP!）のフローを参考に、
-- 「登録 → 審査中 → 承認後に配信可能」という段階を追加する。

alter table artists
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column rights_confirmed bool not null default false,
  add column rights_confirmed_at timestamptz,
  add column reviewed_at timestamptz;

-- 既存アーティストは無審査で運用してきたため、移行時点で承認済みとして扱う
update artists set review_status = 'approved', reviewed_at = now() where review_status = 'pending';

-- 銀行口座情報（出金先・本人名義一致が前提。検証ロジックはアプリ側）
create table artist_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) unique,
  bank_name text not null,
  branch_name text not null,
  account_type text not null check (account_type in ('ordinary', 'checking')),
  account_number text not null,
  account_holder_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table artist_bank_accounts enable row level security;

create policy "artist_bank_accounts_owner_select" on artist_bank_accounts for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "artist_bank_accounts_owner_insert" on artist_bank_accounts for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "artist_bank_accounts_owner_update" on artist_bank_accounts for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
