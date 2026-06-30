-- 多層ジャンルタグ（parent_id で階層化。例: Electronic > Lo-fi）
create table genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid references genres(id),
  created_at timestamptz not null default now()
);

create table track_genres (
  track_id uuid not null references tracks(id),
  genre_id uuid not null references genres(id),
  primary key (track_id, genre_id)
);

create index idx_track_genres_genre on track_genres(genre_id);
create index idx_track_genres_track on track_genres(track_id);

alter table genres enable row level security;
alter table track_genres enable row level security;

create policy "genres_public_read" on genres for select using (true);
create policy "track_genres_public_read" on track_genres for select using (true);
create policy "track_genres_owner_insert" on track_genres for insert with check (
  auth.uid() = (
    select a.user_id from tracks t join artists a on a.id = t.artist_id
    where t.id = track_id
  )
);
create policy "track_genres_owner_delete" on track_genres for delete using (
  auth.uid() = (
    select a.user_id from tracks t join artists a on a.id = t.artist_id
    where t.id = track_id
  )
);

-- 第一階層（マクロジャンル）
insert into genres (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Pop'),
  ('00000000-0000-0000-0000-000000000002', 'Rock'),
  ('00000000-0000-0000-0000-000000000003', 'Electronic'),
  ('00000000-0000-0000-0000-000000000004', 'Hip-Hop'),
  ('00000000-0000-0000-0000-000000000005', 'R&B / Soul'),
  ('00000000-0000-0000-0000-000000000006', 'Folk / Acoustic'),
  ('00000000-0000-0000-0000-000000000007', 'Ambient / Chill'),
  ('00000000-0000-0000-0000-000000000008', 'Jazz');

-- 第二階層（サブジャンル）
insert into genres (name, parent_id) values
  ('City Pop', '00000000-0000-0000-0000-000000000001'),
  ('Bedroom Pop', '00000000-0000-0000-0000-000000000001'),
  ('Alternative Rock', '00000000-0000-0000-0000-000000000002'),
  ('Indie Rock', '00000000-0000-0000-0000-000000000002'),
  ('House', '00000000-0000-0000-0000-000000000003'),
  ('Synthwave', '00000000-0000-0000-0000-000000000003'),
  ('Lo-fi Hip-Hop', '00000000-0000-0000-0000-000000000004'),
  ('Neo Soul', '00000000-0000-0000-0000-000000000005'),
  ('Singer-Songwriter', '00000000-0000-0000-0000-000000000006'),
  ('Ambient', '00000000-0000-0000-0000-000000000007');
