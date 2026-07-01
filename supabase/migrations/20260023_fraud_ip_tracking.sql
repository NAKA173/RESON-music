-- 不正検知バッチ強化：同一IPからの大量再生（種別2）を検知するためIPを記録する。
alter table play_events
  add column ip_address text;
create index idx_play_events_ip on play_events(ip_address, created_at);
