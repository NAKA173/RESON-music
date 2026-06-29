create table user_settings (
  user_id uuid primary key references users(id),

  -- アカウント公開設定
  is_private bool not null default false,

  -- SNS機能
  profile_public bool not null default true,
  feed_enabled bool not null default true,
  follow_enabled bool not null default true,
  matching_enabled bool not null default true,
  comment_enabled bool not null default true,
  community_enabled bool not null default true,
  collection_public bool not null default true,

  -- 受信の可否
  follow_request_from text not null default '全員'
    check (follow_request_from in ('全員', '相互フォロー', '誰も受け取らない')),
  dm_from text not null default '全員'
    check (dm_from in ('全員', 'フォロワーのみ', '受け取らない')),
  comment_notif_from text not null default '全員'
    check (comment_notif_from in ('全員', 'フォロワーのみ', '受け取らない')),
  like_notif bool not null default true,
  matching_suggestion bool not null default true,
  artist_news text not null default '全て通知'
    check (artist_news in ('全て通知', '重要のみ', '受け取らない')),

  -- 支援・クラファン
  support_history_public bool not null default true,
  exclusive_content bool not null default true,
  backer_community bool not null default true,

  -- データ・評価
  score_public bool not null default true,
  listening_data_use bool not null default true,

  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;
create policy "settings_self" on user_settings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger trg_settings_updated_at
  before update on user_settings
  for each row execute function touch_updated_at();
