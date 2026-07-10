-- 人力審査ダッシュボード用の管理者フラグ（CRON_SECRET運用と併存。ダッシュボードは
-- 認証済みユーザーの is_admin を見て権限を判定する）
alter table users
  add column is_admin bool not null default false;

-- 歌詞（表示・入力）
alter table tracks
  add column lyrics text;

-- キュレーターランク（先見性スコア）用：応援した時点でのそのトラックの累計再生数を
-- スナップショットしておく（後から「まだ無名だった頃に応援したか」を判定するため）
alter table supports
  add column track_plays_at_support int,
  add column counted_for_curator bool not null default false;

create table curator_scores (
  user_id uuid primary key references users(id),
  score numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table curator_scores enable row level security;
create policy "curator_scores_public_read" on curator_scores for select using (true);
-- 更新はservice role経由のバッチ処理のみ
