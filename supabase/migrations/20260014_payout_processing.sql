-- 出金処理（管理バッチ）対応：残高50,000円超え通知用の通知種別を追加
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'mention', 'support', 'new_track', 'balance_threshold'));
