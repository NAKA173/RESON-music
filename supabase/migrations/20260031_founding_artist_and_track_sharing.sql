-- SNS機能の充実：楽曲をDMに貼付できるようにする（投稿は既存のposts.track_idで対応済み）
alter table direct_messages
  add column track_id uuid references tracks(id);

-- 創設アーティスト制度（バッジのみ・重み+0.2は未実装）
-- artists.founding_artist は既存カラム。管理UIから付与できるようにするための変更はなし
-- （既存カラムをそのまま利用。ここではDMへのtrack_id追加のみが本マイグレーションの内容）
