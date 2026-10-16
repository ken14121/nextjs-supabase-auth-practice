-- 判定の設定（10/15）。今は「帰省することがあるか」だけ
--
--   profiles は友達も読めるので、家族のことに関わるこの設定は、本人だけが見られる別の表に置く。
--   行が無ければ「帰省することがある」（今までどおり）とみなす

create table public.judge_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  homecoming boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.judge_settings enable row level security;

create policy "自分の判定の設定を見られる"
  on public.judge_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "自分の判定の設定を作れる"
  on public.judge_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "自分の判定の設定を変えられる"
  on public.judge_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update (homecoming, updated_at) on table public.judge_settings to authenticated;
