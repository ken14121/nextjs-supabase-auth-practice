-- 旅に、飛行機の便・新幹線の乗車を本人が手で足せるようにする。新幹線の切符に路線ごとの色を足す（10/15）
--
--   added_by_user：本人が手で足した便・乗車。タイムラインを取り込み直しても消さない
--   has_times：時刻が分かっているか（手で足すときは日付だけでもよい）

alter table public.flights
  add column added_by_user boolean not null default false,
  add column has_times boolean not null default true;

alter table public.train_rides
  add column added_by_user boolean not null default false,
  add column has_times boolean not null default true;

-- デザインの種類は増えていくので、形だけ確かめる（中身はアプリで確かめる）
alter table public.train_rides drop constraint train_rides_design_check;
alter table public.train_rides
  add constraint train_rides_design_check check (design ~ '^[a-z]{2,20}$');

alter table public.outings drop constraint outings_ticket_design_check;
alter table public.outings
  add constraint outings_ticket_design_check
    check (ticket_design ~ '^(atlas|mint|sky|retro|noir|pass-[a-z]{2,20}|rail-[a-z]{2,20})$');
