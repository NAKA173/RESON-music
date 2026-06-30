-- 紹介制（招待制とは別）：誰がリスナー/アーティストでも友人を招待できる。特典なし・記録のみ。
create or replace function generate_referral_code()
returns text language plpgsql as $$
declare
  code text;
  code_exists boolean;
begin
  loop
    code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    select exists(select 1 from users where referral_code = code) into code_exists;
    if not code_exists then
      return code;
    end if;
  end loop;
end;
$$;

alter table users add column referral_code text unique;
update users set referral_code = generate_referral_code() where referral_code is null;
alter table users alter column referral_code set not null;
alter table users alter column referral_code set default generate_referral_code();

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id),
  referred_id uuid not null unique references users(id),
  created_at timestamptz not null default now()
);

create index idx_referrals_referrer on referrals(referrer_id);

alter table referrals enable row level security;

-- 自分が紹介した/紹介された記録のみ閲覧可能
create policy "referrals_self_read" on referrals for select using (
  auth.uid() = referrer_id or auth.uid() = referred_id
);

-- INSERTはservice role経由のみ（紹介コードの照合はサーバー側で実施するため）
