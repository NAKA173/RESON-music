-- 未成年アーティストの親権者同意フロー（登録フローの権利確認ステップに追加）
-- 自己申告制・自動年齢確認は行わない（既存のrights_confirmedと同様の最小実装）。

alter table artists
  add column is_minor bool not null default false,
  add column parent_consent_name text,
  add column parent_consent_contact text;
