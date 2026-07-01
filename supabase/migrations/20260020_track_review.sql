-- 楽曲登録審査（配信代行サービスのフローを参考：楽曲ごとに審査 → 配信開始）
-- 先に実装したartists.review_statusはアーティスト登録の審査。こちらは楽曲単位の審査で、
-- ユーザーが実際に意図していた「登録のプロセス」はこちらの楽曲登録フローを指す。

alter table tracks
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column reviewed_at timestamptz;

-- 既存の楽曲は無審査で配信してきたため、承認済みとして移行する
update tracks set review_status = 'approved', reviewed_at = now() where review_status = 'pending';
