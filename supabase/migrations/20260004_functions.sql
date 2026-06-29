-- cumulative_plays を play_events INSERT 後に自動インクリメント
create or replace function increment_cumulative_plays()
returns trigger language plpgsql security definer as $$
begin
  -- sec_factor = 0 の再生（30秒未満）はカウントしない
  if NEW.sec_factor > 0 then
    update tracks
    set
      cumulative_plays = cumulative_plays + 1,
      in_distribution = (cumulative_plays + 1) >= 100
    where id = NEW.track_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_increment_plays
after insert on play_events
for each row execute function increment_cumulative_plays();

-- artist_balances の updated_at を自動更新
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger trg_balances_updated_at
before update on artist_balances
for each row execute function touch_updated_at();
