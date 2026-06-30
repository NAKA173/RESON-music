-- ジャンル別コミュニティ・ライブ情報・音楽人格・ブロック/通報・RLS拡張（v3.4第9章）

-- ジャンル別コミュニティ参加（投稿は既存postsにgenre_idを足して紐付ける）
create table community_members (
  user_id uuid not null references users(id),
  genre_id uuid not null references genres(id),
  joined_at timestamptz not null default now(),
  primary key (user_id, genre_id)
);
create index idx_community_members_genre on community_members(genre_id);

alter table posts add column if not exists genre_id uuid references genres(id);
create index idx_posts_genre on posts(genre_id);

-- ライブ情報（イベント）
create table events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id),
  title text not null check (char_length(title) <= 200),
  description text check (char_length(description) <= 2000),
  event_at timestamptz not null,
  location text,
  ticket_url text,
  created_at timestamptz not null default now()
);
create index idx_events_artist on events(artist_id);
create index idx_events_upcoming on events(event_at);

create table event_attendees (
  event_id uuid not null references events(id),
  user_id uuid not null references users(id),
  status text not null default 'interested' check (status in ('interested', 'going')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index idx_event_attendees_event on event_attendees(event_id);

-- 音楽人格（UserProfile・MVPはユーザー編集の自己申告タグ。聴取データからの自動算出はPhase 4以降の課題）
create table user_profiles (
  user_id uuid primary key references users(id),
  display_name text check (char_length(display_name) <= 50),
  bio text check (char_length(bio) <= 280),
  persona_tags text[] not null default '{}',
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- ブロック（一方向。フォロー・コメント等の相互作用をAPI層で抑制する）
create table blocks (
  blocker_id uuid not null references users(id),
  blocked_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index idx_blocks_blocked on blocks(blocked_id);

-- 通報（投稿・コメント・ユーザー・アーティストを対象。最小実装：保存のみ・人力審査ダッシュボードは未実装）
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_type text not null check (target_type in ('post', 'comment', 'user', 'artist')),
  target_id uuid not null,
  reason text not null check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);
create index idx_reports_status on reports(status) where status = 'pending';

alter table community_members enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table user_profiles enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

-- community_members: 参加状況は公開（人数表示用）。本人のみ参加/離脱
create policy "community_members_public_read" on community_members for select using (true);
create policy "community_members_self_insert" on community_members for insert with check (auth.uid() = user_id);
create policy "community_members_self_delete" on community_members for delete using (auth.uid() = user_id);

-- events: 誰でも読める。アーティスト本人のみ作成
create policy "events_public_read" on events for select using (true);
create policy "events_owner_insert" on events for insert with check (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "events_owner_update" on events for update using (
  auth.uid() = (select user_id from artists where id = artist_id)
);
create policy "events_owner_delete" on events for delete using (
  auth.uid() = (select user_id from artists where id = artist_id)
);

-- event_attendees: 誰でも読める（人数表示用）。本人のみ登録/解除
create policy "event_attendees_public_read" on event_attendees for select using (true);
create policy "event_attendees_self_insert" on event_attendees for insert with check (auth.uid() = user_id);
create policy "event_attendees_self_update" on event_attendees for update using (auth.uid() = user_id);
create policy "event_attendees_self_delete" on event_attendees for delete using (auth.uid() = user_id);

-- user_profiles: 誰でも読める。本人のみ作成・更新
create policy "user_profiles_public_read" on user_profiles for select using (true);
create policy "user_profiles_self_insert" on user_profiles for insert with check (auth.uid() = user_id);
create policy "user_profiles_self_update" on user_profiles for update using (auth.uid() = user_id);

-- blocks: 本人（ブロックした側）のみ参照・作成・解除。対象者からは見えない
create policy "blocks_self_read" on blocks for select using (auth.uid() = blocker_id);
create policy "blocks_self_insert" on blocks for insert with check (auth.uid() = blocker_id);
create policy "blocks_self_delete" on blocks for delete using (auth.uid() = blocker_id);

-- reports: 通報者本人のみ自分の通報を参照可能。INSERTは本人のみ。審査(status更新)はservice role経由のみ
create policy "reports_self_read" on reports for select using (auth.uid() = reporter_id);
create policy "reports_self_insert" on reports for insert with check (auth.uid() = reporter_id);
