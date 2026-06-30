-- SNSレイヤー（第9章）: フォロー・投稿・コメント・いいね・通知

-- フォロー（ユーザー or アーティストを対象）
create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references users(id),
  followee_type text not null check (followee_type in ('user', 'artist')),
  followee_id uuid not null,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_type, followee_id)
);
create index idx_follows_follower on follows(follower_id);
create index idx_follows_followee on follows(followee_type, followee_id);

-- 投稿
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references users(id),
  author_artist_id uuid references artists(id),
  track_id uuid references tracks(id),
  body text not null check (char_length(body) <= 1000),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private', 'supporter_only')),
  status text not null default 'active' check (status in ('active', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_posts_author on posts(author_user_id, created_at desc);
create index idx_posts_track on posts(track_id);

-- コメント
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  user_id uuid not null references users(id),
  body text not null check (char_length(body) <= 500),
  status text not null default 'active' check (status in ('active', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_comments_post on comments(post_id, created_at);

-- いいね（投稿・楽曲・コメント・アーティストへの汎用反応）
create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  target_type text not null check (target_type in ('post', 'track', 'comment', 'artist')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index idx_likes_target on likes(target_type, target_id);

-- 通知
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  type text not null check (type in ('follow', 'like', 'comment', 'mention', 'support', 'new_track')),
  actor_user_id uuid references users(id),
  target_type text,
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

alter table follows enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;
alter table notifications enable row level security;

-- follows: 誰でも読める（フォロー関係は公開情報）。本人のみフォロー/解除
create policy "follows_public_read" on follows for select using (true);
create policy "follows_self_insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_self_delete" on follows for delete using (auth.uid() = follower_id);

-- posts: public/supporter_onlyは誰でも読める。followers/privateは本人のみ（フォロワー限定の厳密な絞り込みはAPI側で実施）
create policy "posts_public_read" on posts for select using (
  visibility in ('public', 'supporter_only') or auth.uid() = author_user_id
);
create policy "posts_self_insert" on posts for insert with check (auth.uid() = author_user_id);
create policy "posts_self_update" on posts for update using (auth.uid() = author_user_id);
create policy "posts_self_delete" on posts for delete using (auth.uid() = author_user_id);

-- comments: 誰でも読める。本人のみ投稿・削除
create policy "comments_public_read" on comments for select using (true);
create policy "comments_self_insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments_self_delete" on comments for delete using (auth.uid() = user_id);

-- likes: 誰でも読める。本人のみ追加・解除
create policy "likes_public_read" on likes for select using (true);
create policy "likes_self_insert" on likes for insert with check (auth.uid() = user_id);
create policy "likes_self_delete" on likes for delete using (auth.uid() = user_id);

-- notifications: 本人のみ読み取り・既読更新。INSERTはservice role経由のみ
create policy "notifications_self_read" on notifications for select using (auth.uid() = user_id);
create policy "notifications_self_update" on notifications for update using (auth.uid() = user_id);
