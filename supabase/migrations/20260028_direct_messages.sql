-- SNS系機能の充実：ダイレクトメッセージ（1:1）
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'mention', 'support', 'new_track', 'balance_threshold', 'message'));

create table direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id),
  recipient_id uuid not null references users(id),
  body text not null check (char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_direct_messages_conversation on direct_messages(sender_id, recipient_id, created_at);
create index idx_direct_messages_recipient on direct_messages(recipient_id, created_at desc);

alter table direct_messages enable row level security;

-- 送信者・受信者本人のみ読める。送信は本人（sender_id）のみ
create policy "direct_messages_participant_read" on direct_messages for select using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);
create policy "direct_messages_sender_insert" on direct_messages for insert with check (
  auth.uid() = sender_id
);
-- 既読更新は受信者のみ
create policy "direct_messages_recipient_update" on direct_messages for update using (
  auth.uid() = recipient_id
);
