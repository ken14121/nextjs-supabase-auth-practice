-- 飛行機の便（搭乗券にする）（10/14）
--
--   タイムラインの「飛行機での移動」1 回 = 1 行。出発・到着の空港は、移動の始点・終点に
--   一番近い空港の IATA コード（わからなければ null）。座標は保存しない
--   design は搭乗券のデザイン（本人が選んだもの。null なら自動）
--   今は本人だけが見られる

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outing_id uuid not null references public.outings (id) on delete cascade,
  departed_at timestamptz not null,
  arrived_at timestamptz not null,
  from_airport text check (from_airport ~ '^[A-Z]{3}$'),
  to_airport text check (to_airport ~ '^[A-Z]{3}$'),
  distance_km numeric(8, 1) not null default 0 check (distance_km >= 0),
  design text check (design in ('classic', 'mono', 'sand', 'noir')),
  created_at timestamptz not null default now(),
  constraint flights_period_check check (arrived_at >= departed_at)
);

create index flights_user_departed_idx on public.flights (user_id, departed_at);
create index flights_outing_idx on public.flights (outing_id);

alter table public.flights enable row level security;

create policy "自分の便を見られる"
  on public.flights for select to authenticated
  using (user_id = (select auth.uid()));

-- 追加するときは、自分の外出にしかぶら下げられない
create policy "自分の外出に便を追加できる"
  on public.flights for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.outings o
      where o.id = flights.outing_id and o.user_id = (select auth.uid())
    )
  );

create policy "自分の便のデザインを変えられる"
  on public.flights for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "自分の便を消せる"
  on public.flights for delete to authenticated
  using (user_id = (select auth.uid()));

-- 書き換えられるのはデザインだけ
grant select, insert, delete, update (design) on table public.flights to authenticated;
