-- 自由な曲数のプレイリスト（ベストトラックランキング＝Topsterとは別物。上限なし・並び替え自由）
create table playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  title text not null check (char_length(title) <= 100),
  is_public bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_playlists_user on playlists(user_id);

create table playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  track_id uuid not null references tracks(id),
  position int not null,
  added_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);
create index idx_playlist_tracks_playlist on playlist_tracks(playlist_id, position);

alter table playlists enable row level security;
alter table playlist_tracks enable row level security;

create policy "playlists_public_read" on playlists for select using (
  is_public = true or auth.uid() = user_id
);
create policy "playlists_owner_insert" on playlists for insert with check (auth.uid() = user_id);
create policy "playlists_owner_update" on playlists for update using (auth.uid() = user_id);
create policy "playlists_owner_delete" on playlists for delete using (auth.uid() = user_id);

create policy "playlist_tracks_read" on playlist_tracks for select using (
  exists (select 1 from playlists p where p.id = playlist_id and (p.is_public = true or p.user_id = auth.uid()))
);
create policy "playlist_tracks_owner_insert" on playlist_tracks for insert with check (
  exists (select 1 from playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
create policy "playlist_tracks_owner_update" on playlist_tracks for update using (
  exists (select 1 from playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
create policy "playlist_tracks_owner_delete" on playlist_tracks for delete using (
  exists (select 1 from playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
