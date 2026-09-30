-- 旅アプリの基本テーブルと RLS（行レベルセキュリティ）
--
--   auth.users（Supabase が管理。Google でログインした人）
--     ├─ profiles         1 人 1 行。表示名とフレンドコード
--     ├─ outings          外出 1 回ぶん（家を出て戻るまで）
--     │    └─ visited_regions  その外出で行った県・国と日付
--     └─ friendships      友達申請（誰から誰へ・申請中か承認済みか）
--
-- 方針
--   - テーブルは基本「本人だけ」が読み書きできる
--   - 友達には「行った県・国と日付」だけを、専用の関数（get_friend_visited_regions）で渡す
--   - このプロジェクトは「新しいテーブルを自動で API に公開しない」設定なので、
--     使うテーブルごとに authenticated（ログイン済みユーザー）へ権限を付ける


-- =====================================================================
-- profiles：友達を探すときの名札
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  -- 8 文字のランダムな英数字。友達に教えて、つながるときに使う
  friend_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

-- ログインした人が初めて登録されたとき、自動で profiles を作る
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- このマイグレーションより前にログイン済みのユーザーにも profiles を作っておく
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;


-- =====================================================================
-- outings：外出 1 回ぶん
-- =====================================================================
create table public.outings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  nights integer not null default 0 check (nights >= 0),
  distance_km numeric(8, 1) not null default 0 check (distance_km >= 0),
  -- 一番長く使った移動手段（例: train / car / walk / flight）
  main_transport text,
  -- Jev の判定結果。まだ判定していなければ null
  label text check (label in ('trip', 'homecoming', 'day_trip', 'daily')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  constraint outings_period_check check (ended_at >= started_at)
);

create index outings_user_started_idx on public.outings (user_id, started_at desc);


-- =====================================================================
-- visited_regions：その外出で行った県・国
-- =====================================================================
create table public.visited_regions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outing_id uuid not null references public.outings (id) on delete cascade,
  -- 都道府県は ISO 3166-2（JP-13 = 東京都）、国は ISO 3166-1（US = アメリカ）
  region_code text not null check (region_code ~ '^[A-Z]{2}(-[0-9A-Z]{1,3})?$'),
  -- 日本時間での日付
  visited_on date not null,
  unique (outing_id, region_code, visited_on)
);

create index visited_regions_user_region_idx on public.visited_regions (user_id, region_code);


-- =====================================================================
-- friendships：友達申請
-- =====================================================================
create table public.friendships (
  requester_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- A→B と B→A の申請が両方できないようにする
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);


-- =====================================================================
-- RLS（行レベルセキュリティ）
-- auth.uid() は「今ログインしている人の ID」。
-- (select auth.uid()) と書くと、行ごとではなく 1 回だけ計算されて速い。
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.outings enable row level security;
alter table public.visited_regions enable row level security;
alter table public.friendships enable row level security;

-- profiles：自分と、申請中・承認済みの相手の名札だけ見られる。書き換えは自分だけ
create policy "自分と友達のプロフィールを見られる"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
         or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
    )
  );

create policy "自分のプロフィールだけ更新できる"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- outings：本人だけ
create policy "自分の外出を見られる"
  on public.outings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "自分の外出を追加できる"
  on public.outings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "自分の外出を更新できる"
  on public.outings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "自分の外出を削除できる"
  on public.outings for delete to authenticated
  using (user_id = (select auth.uid()));

-- visited_regions：本人だけ。追加するときは、自分の外出にしかぶら下げられない
create policy "自分の訪問地を見られる"
  on public.visited_regions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "自分の外出に訪問地を追加できる"
  on public.visited_regions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.outings o
      where o.id = visited_regions.outing_id and o.user_id = (select auth.uid())
    )
  );

create policy "自分の訪問地を削除できる"
  on public.visited_regions for delete to authenticated
  using (user_id = (select auth.uid()));

-- friendships：自分が関係する申請だけ
create policy "自分が関係する友達申請を見られる"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "自分から友達申請を送れる"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "届いた申請だけ承認できる"
  on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()));

create policy "自分が関係する申請・友達関係を削除できる"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));


-- =====================================================================
-- 権限（テーブルを API から使えるようにする）
-- 列を指定した update は、その列しか書き換えられない
-- =====================================================================
grant select, update (display_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.outings to authenticated;
grant select, insert, delete on table public.visited_regions to authenticated;
grant select, insert, delete, update (status) on table public.friendships to authenticated;


-- =====================================================================
-- 関数（RLS だけでは表せない「友達向けの見せ方」）
-- security definer はテーブルの持ち主の権限で動く。
-- 中で必ず「友達かどうか」を確かめてから、必要な列だけを返す。
-- =====================================================================

-- フレンドコードから相手を探す（自分は除く）
create function public.find_profile_by_friend_code(code text)
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.friend_code = lower(trim(code))
    and p.id <> (select auth.uid());
$$;

-- 承認済みの友達の「行った県・国と日付」を返す。日常の外出と未判定の外出は含めない
create function public.get_friend_visited_regions(friend_id uuid)
returns table (region_code text, visited_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select vr.region_code, vr.visited_on
  from public.visited_regions vr
  join public.outings o on o.id = vr.outing_id
  where vr.user_id = friend_id
    and o.label in ('trip', 'homecoming', 'day_trip')
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = friend_id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = friend_id)
        )
    )
  order by vr.visited_on;
$$;

revoke execute on function public.find_profile_by_friend_code(text) from public, anon;
revoke execute on function public.get_friend_visited_regions(uuid) from public, anon;
grant execute on function public.find_profile_by_friend_code(text) to authenticated;
grant execute on function public.get_friend_visited_regions(uuid) to authenticated;
