-- play_events: 月次バッチで大量集計するため
create index idx_play_events_track_created on play_events (track_id, created_at);
create index idx_play_events_user_track on play_events (user_id, track_id, created_at);

-- supports: 応援率の集計
create index idx_supports_track on supports (track_id);

-- monthly_distributions: アーティスト×月の検索
create index idx_monthly_distributions_artist_month on monthly_distributions (artist_id, year_month);

-- fraud_flags: 未解決フラグの監視
create index idx_fraud_flags_unresolved on fraud_flags (resolved, created_at) where resolved = false;

-- tracks: 分配対象楽曲の絞り込み
create index idx_tracks_in_distribution on tracks (in_distribution) where in_distribution = true;

-- support_plus_tip_batches: 月末精算
create index idx_tip_batches_unprocessed on support_plus_tip_batches (processed, year_month) where processed = false;
