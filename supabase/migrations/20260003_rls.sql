-- Row Level Security

alter table users enable row level security;
alter table artists enable row level security;
alter table tracks enable row level security;
alter table track_splits enable row level security;
alter table play_events enable row level security;
alter table supports enable row level security;
alter table monthly_distributions enable row level security;
alter table artist_balances enable row level security;
alter table support_plus_tip_batches enable row level security;
alter table fraud_flags enable row level security;

-- users: 自分のレコードのみ読み書き
create policy "users_self_read" on users for select using (auth.uid() = id);
create policy "users_self_update" on users for update using (auth.uid() = id);

-- artists: 本人のみ更新。全員が読める（公開プロフィール）
create policy "artists_public_read" on artists for select using (true);
create policy "artists_owner_update" on artists for update using (
  auth.uid() = user_id
);
create policy "artists_owner_insert" on artists for insert with check (
  auth.uid() = user_id
);

-- tracks: 公開読み取り。アーティスト本人のみ更新
create policy "tracks_public_read" on tracks for select using (true);
create policy "tracks_owner_insert" on tracks for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "tracks_owner_update" on tracks for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- play_events: INSERTのみ（自分の再生のみ）。SELECTはservice role経由のみ
create policy "play_events_user_insert" on play_events for insert with check (
  auth.uid() = user_id
);

-- supports: 自分の応援のみ挿入。閲覧は本人のみ
create policy "supports_user_insert" on supports for insert with check (
  auth.uid() = user_id
);
create policy "supports_user_read" on supports for select using (
  auth.uid() = user_id
);

-- monthly_distributions: アーティスト本人のみ閲覧
create policy "distributions_artist_read" on monthly_distributions for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- artist_balances: アーティスト本人のみ閲覧
create policy "balances_artist_read" on artist_balances for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- track_splits: 関係アーティストのみ閲覧・更新
create policy "splits_artist_read" on track_splits for select using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "splits_artist_update" on track_splits for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- support_plus_tip_batches: 本人のみ
create policy "tip_batches_user_read" on support_plus_tip_batches for select using (
  auth.uid() = user_id
);

-- fraud_flags: service role のみアクセス（RLSでブロック）
-- （管理者はservice_role_keyで直アクセス）
