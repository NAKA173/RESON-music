-- シングル/EP/アルバムの区別、曲順、楽曲ジャケット画像

alter table albums
  add column release_type text not null default 'album'
    check (release_type in ('single', 'ep', 'album'));

alter table tracks
  add column track_number int,
  add column cover_r2_key text;
