-- 月次レポート通知
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'mention', 'support', 'new_track', 'balance_threshold', 'message', 'monthly_report'));

-- 不正検知フラグ level 2/3 の実際の非公開化（配信停止）ロジック用
alter table tracks
  add column fraud_suspended bool not null default false;
