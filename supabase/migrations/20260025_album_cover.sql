-- アルバムジャケット画像（R2アップロード対応。既存のcover_url（外部URL直接指定）とは併存させ、
-- cover_r2_keyがある場合はそちらを優先表示する）
alter table albums
  add column cover_r2_key text;
