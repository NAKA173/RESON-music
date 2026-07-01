-- 追加ブースト（30円）の課金方式変更：都度Stripe決済ではなく、月次カウントを
-- サブスクリプションの次回請求に合算する（Stripeの実用上の最低決済額50円問題への対応）。

alter table boost_hearts
  add column billed bool not null default false;

-- 既存の有料ブースト（都度課金）はすべて処理済みとして扱う
update boost_hearts set billed = true where amount_yen > 0;

-- 月次バッチで未請求の追加ブーストをアーティストごとに集計し、残高へ加算する。
-- 実際の請求（顧客への課金）は Stripe の pending invoice item 経由でAPI層が別途行う。
create or replace function settle_monthly_boosts(p_year_month text)
returns void language plpgsql security definer as $$
declare
  rec record;
begin
  for rec in
    select
      t.artist_id,
      sum(b.amount_yen) as total
    from boost_hearts b
    join tracks t on t.id = b.track_id
    where b.year_month = p_year_month
      and b.amount_yen > 0
      and b.billed = false
    group by t.artist_id
  loop
    perform add_artist_balance(rec.artist_id, rec.total * 0.7);
  end loop;

  update boost_hearts
    set billed = true
    where year_month = p_year_month
      and amount_yen > 0
      and billed = false;
end;
$$;
