-- Studentプラン用 .ed.jp メール認証（v3.4第9章・Phase 3）
create table student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  school_email text not null,
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified bool not null default false,
  created_at timestamptz not null default now()
);

create index idx_student_verifications_user on student_verifications(user_id, created_at desc);

alter table student_verifications enable row level security;

create policy "student_verifications_owner_read" on student_verifications for select using (
  auth.uid() = user_id
);
create policy "student_verifications_owner_insert" on student_verifications for insert with check (
  auth.uid() = user_id
);
create policy "student_verifications_owner_update" on student_verifications for update using (
  auth.uid() = user_id
);
