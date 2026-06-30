-- アルバム概念・ベストトラックランキング（Topster風プロフィール）

-- アルバム（楽曲のまとまり。MVPはアーティスト本人が任意で作成・楽曲に紐付ける）
create table albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  title text not null check (char_length(title) <= 200),
  cover_url text,
  released_at date,
  created_at timestamptz not null default now()
);
create index idx_albums_artist on albums(artist_id);

alter table tracks add column if not exists album_id uuid references albums(id);
create index idx_tracks_album on tracks(album_id);

-- ベストトラックランキング（自己申告のお気に入り楽曲ランキング・Topster風プロフィール表示用）
create table best_tracks (
  user_id uuid not null references users(id),
  rank int not null check (rank between 1 and 10),
  track_id uuid not null references tracks(id),
  created_at timestamptz not null default now(),
  primary key (user_id, rank),
  unique (user_id, track_id)
);

alter table albums enable row level security;
alter table best_tracks enable row level security;

-- albums: 誰でも読める。アーティスト本人のみ作成/更新/削除
create policy "albums_public_read" on albums for select using (true);
create policy "albums_owner_insert" on albums for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "albums_owner_update" on albums for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "albums_owner_delete" on albums for delete using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- best_tracks: 誰でも読める（プロフィール公開表示用）。本人のみ作成/更新/削除
create policy "best_tracks_public_read" on best_tracks for select using (true);
create policy "best_tracks_self_insert" on best_tracks for insert with check (auth.uid() = user_id);
create policy "best_tracks_self_update" on best_tracks for update using (auth.uid() = user_id);
create policy "best_tracks_self_delete" on best_tracks for delete using (auth.uid() = user_id);
