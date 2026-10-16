-- 搭乗券のバーコードから読んだ情報を、便に足す（10/14）
--
--   航空会社・便名・座席だけを保存する。名前と予約番号はブラウザで読み飛ばし、送らない・保存しない

alter table public.flights
  add column airline text check (airline ~ '^[A-Z0-9]{2,3}$'),
  add column flight_number text check (flight_number ~ '^[0-9]{1,4}[A-Z]?$'),
  add column seat text check (seat ~ '^[0-9]{1,3}[A-Z]$');

-- 本人が書き換えられるのは、デザインと、搭乗券から読んだこの 3 つだけ
grant update (airline, flight_number, seat) on table public.flights to authenticated;
