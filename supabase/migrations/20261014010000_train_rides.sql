-- 新幹線の乗車（切符にする）（10/14）
--
--   タイムラインの「電車での移動」のうち、新幹線の駅どうしを速く移動したもの 1 回 = 1 行。
--   駅は lib/geo/shinkansen.ts の一覧の id（例: tokyo / shin-osaka）。座標は保存しない
--   design は切符のデザイン（本人が選んだもの。null なら自動）。今は本人だけが見られる

create table public.train_rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outing_id uuid not null references public.outings (id) on delete cascade,
  departed_at timestamptz not null,
  arrived_at timestamptz not null,
  from_station text not null check (from_station ~ '^[a-z-]{2,40}$'),
  to_station text not null check (to_station ~ '^[a-z-]{2,40}$'),
  distance_km numeric(8, 1) not null default 0 check (distance_km >= 0),
  design text check (design in ('mint', 'sky', 'retro')),
  created_at timestamptz not null default now(),
  constraint train_rides_period_check check (arrived_at >= departed_at)
);

create index train_rides_outing_idx on public.train_rides (outing_id);

alter table public.train_rides enable row level security;

create policy "自分の乗車を見られる"
  on public.train_rides for select to authenticated
  using (user_id = (select auth.uid()));

-- 追加するときは、自分の外出にしかぶら下げられない
create policy "自分の外出に乗車を追加できる"
  on public.train_rides for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.outings o
      where o.id = train_rides.outing_id and o.user_id = (select auth.uid())
    )
  );

create policy "自分の乗車のデザインを変えられる"
  on public.train_rides for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "自分の乗車を消せる"
  on public.train_rides for delete to authenticated
  using (user_id = (select auth.uid()));

-- 書き換えられるのはデザインだけ
grant select, insert, delete, update (design) on table public.train_rides to authenticated;
