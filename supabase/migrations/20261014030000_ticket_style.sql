-- 搭乗券・新幹線の切符を、本人が飾れるようにする（10/14）
--
--   style = { accent: "#rrggbb", mark: "heart" など, emoji: "🍜✨", stamp: "初めての一人旅" }
--   中身の形はアプリ（lib/outings/ticket-style.ts）で確かめる。ここでは大きさだけ制限する

alter table public.flights
  add column style jsonb not null default '{}'::jsonb
    check (jsonb_typeof(style) = 'object' and pg_column_size(style) < 600);

alter table public.train_rides
  add column style jsonb not null default '{}'::jsonb
    check (jsonb_typeof(style) = 'object' and pg_column_size(style) < 600);

grant update (style) on table public.flights to authenticated;
grant update (style) on table public.train_rides to authenticated;
