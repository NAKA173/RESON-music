-- ペアレンタル決済フロー（未成年リスナーの月額決済を保護者に紐付ける）
-- users.parent_user_id は既存カラム。ここでは紐付けリクエスト（本人申請→保護者承認）の
-- ためのトークン方式のテーブルを追加する（メール送信基盤が未構築のため、リンク共有は
-- 既存の招待フローと同様に本人がURLを保護者に直接共有する運用を前提とする）。

create table parental_link_requests (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  parent_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_parental_link_requests_child on parental_link_requests(child_user_id);

alter table parental_link_requests enable row level security;

-- 申請者本人（子）は自分の申請を作成・閲覧できる
create policy "parental_link_requests_child_read" on parental_link_requests for select using (
  auth.uid() = child_user_id
);
create policy "parental_link_requests_child_insert" on parental_link_requests for insert with check (
  auth.uid() = child_user_id
);
-- 承認する保護者側はservice role経由のAPI（トークン検証込み）でのみ更新する
