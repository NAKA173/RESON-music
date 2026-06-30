-- 出金申請（最低1,000円・締め日翌月15日払い・手動処理を前提とした最小実装）
create table payout_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  amount_yen numeric not null check (amount_yen >= 1000),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_payout_requests_artist on payout_requests(artist_id);
create index idx_payout_requests_pending on payout_requests(status) where status = 'pending';

alter table payout_requests enable row level security;

create policy "payout_requests_owner_read" on payout_requests for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "payout_requests_owner_insert" on payout_requests for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
