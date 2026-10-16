-- バス・在来線・船・車の移動を、旅に本人が手で足せるようにする（10/15）
--
--   例：修学旅行で、広島からバスで 5 日間かけて愛媛・香川・徳島・兵庫をめぐった
--   出発地・到着地は本人が書いた名前（駅名・町の名前など）。座標は持たない
--   今は本人だけが見られる

create table public.ground_legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outing_id uuid not null references public.outings (id) on delete cascade,
  mode text not null check (mode in ('bus', 'train', 'boat', 'car')),
  from_name text not null check (char_length(from_name) between 1 and 30),
  to_name text not null check (char_length(to_name) between 1 and 30),
  departed_at timestamptz not null,
  arrived_at timestamptz not null,
  has_times boolean not null default true,
  design text check (design ~ '^[a-z]{2,20}$'),
  style jsonb not null default '{}'::jsonb
    check (jsonb_typeof(style) = 'object' and pg_column_size(style) < 600),
  created_at timestamptz not null default now(),
  constraint ground_legs_period_check check (arrived_at >= departed_at)
);

create index ground_legs_outing_idx on public.ground_legs (outing_id);

alter table public.ground_legs enable row level security;

create policy "自分の移動を見られる"
  on public.ground_legs for select to authenticated
  using (user_id = (select auth.uid()));

-- 追加するときは、自分の外出にしかぶら下げられない
create policy "自分の外出に移動を足せる"
  on public.ground_legs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.outings o
      where o.id = ground_legs.outing_id and o.user_id = (select auth.uid())
    )
  );

create policy "自分の移動の見た目を変えられる"
  on public.ground_legs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "自分の移動を消せる"
  on public.ground_legs for delete to authenticated
  using (user_id = (select auth.uid()));

-- 書き換えられるのは見た目（デザイン・飾り）だけ
grant select, insert, delete, update (design, style) on table public.ground_legs to authenticated;
