-- monthly_distributions の冪等 upsert 用
alter table monthly_distributions
  add constraint monthly_distributions_artist_month_unique
  unique (artist_id, year_month);

-- artist_balances への残高加算（レースコンディション対策）
create or replace function add_artist_balance(p_artist_id uuid, p_amount numeric)
returns void language plpgsql security definer as $$
begin
  insert into artist_balances (artist_id, balance_yen, updated_at)
  values (p_artist_id, p_amount, now())
  on conflict (artist_id) do update
    set balance_yen = artist_balances.balance_yen + p_amount,
        updated_at  = now();
end;
$$;

-- Support+ 投げ銭の月末精算バッチ用
create or replace function settle_support_plus_tips(p_year_month text)
returns void language plpgsql security definer as $$
declare
  rec record;
  stripe_fee int;
  net numeric;
begin
  for rec in
    select
      s.user_id,
      t.artist_id,
      sum(s.amount_yen) as total
    from supports s
    join tracks t on t.id = s.track_id
    join users u on u.id = s.user_id
    where u.plan = 'support_plus'
      and to_char(s.created_at, 'YYYY-MM') = p_year_month
      and s.amount_yen > 0
    group by s.user_id, t.artist_id
  loop
    stripe_fee := ceil(rec.total * 0.036);
    net := rec.total - stripe_fee;

    insert into support_plus_tip_batches
      (user_id, year_month, total_tips_yen, stripe_fee_yen, net_yen)
    values
      (rec.user_id, p_year_month, rec.total, stripe_fee, net)
    on conflict do nothing;

    -- アーティスト残高に加算
    perform add_artist_balance(rec.artist_id, net);
  end loop;
end;
$$;
