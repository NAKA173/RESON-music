-- ISRC（国際標準レコーディングコード）。自己申告制の任意項目（fingerprint/AcoustIDと
-- 同じ「未入力可・重複のみ検知」方針）。ハイフンなし12文字の正規形で保存する。
alter table tracks
  add column isrc text
    check (isrc is null or isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$');

-- NULLは重複チェック対象外（複数曲がisrc未入力でも問題ない）
create unique index idx_tracks_isrc_unique on tracks (isrc) where isrc is not null;
