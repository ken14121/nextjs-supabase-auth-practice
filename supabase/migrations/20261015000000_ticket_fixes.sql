-- 切符を本人が直せるようにする（10/15）
--
--   ・飛行機の便：空港が違っていたら本人が直せる（飛び立ってから位置が記録されると、近くの別の空港になることがある）。
--     直した便は airports_fixed = true にし、取り込み直しても本人の空港を残す
--   ・飛行機・新幹線の記録が無い旅（ドライブ・手入力の旅など）の切符も、種類・デザイン・飾りを選べる
--     ticket_kind / ticket_design が null なら自動。ticket_style は飾り（lib/outings/ticket-style.ts）

alter table public.flights
  add column airports_fixed boolean not null default false;

-- 空港を直すと距離も空港どうしの距離に合わせるので、距離も書き換えられるようにする
grant update (from_airport, to_airport, distance_km, airports_fixed)
  on table public.flights to authenticated;

alter table public.outings
  add column ticket_kind text
    check (ticket_kind in ('flight', 'express', 'train', 'car', 'bus', 'boat', 'journey')),
  add column ticket_design text
    check (ticket_design in ('atlas', 'mint', 'sky', 'retro', 'noir')),
  add column ticket_style jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ticket_style) = 'object' and pg_column_size(ticket_style) < 600);
-- outings は本人がすべての列を書き換えられる（20260930000000 で grant 済み）
