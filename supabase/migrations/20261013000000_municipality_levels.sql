-- 市区町村踏破：市区町村ごとの「経験値」（10/13）
--
--   5 住居・4 宿泊・3 訪問・2 接地・1 通過（lib/timeline/municipality-levels.ts）
--   1 人 1 市区町村 1 行。取り込むたびに、経験値は高い方、日付は広がる方に合わせる
--   座標は保存しない。保存するのは市区町村コードと経験値と日付だけ
--   今は本人だけが見られる（友達には見せない）

create table public.municipality_levels (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 市区町村コード 5 桁（上 2 桁が都道府県。例: 13101 = 千代田区）
  code text not null check (code ~ '^[0-9]{5}$'),
  level smallint not null check (level between 1 and 5),
  first_visited_on date not null,
  last_visited_on date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, code),
  constraint municipality_levels_period_check check (last_visited_on >= first_visited_on)
);

alter table public.municipality_levels enable row level security;

create policy "自分の市区町村の経験値を見られる"
  on public.municipality_levels for select to authenticated
  using (user_id = (select auth.uid()));

create policy "自分の市区町村の経験値を追加できる"
  on public.municipality_levels for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "自分の市区町村の経験値を更新できる"
  on public.municipality_levels for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "自分の市区町村の経験値を消せる"
  on public.municipality_levels for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.municipality_levels to authenticated;
