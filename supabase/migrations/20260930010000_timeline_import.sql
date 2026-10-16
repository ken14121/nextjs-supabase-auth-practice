-- Timeline.json の取り込みに必要なもの
--   - Storage のバケット（アップロードしたファイルの一時置き場）と、その RLS
--   - 同じ外出を 2 回取り込んでも重複しないための制約
--   - 自分が行った県・国の一覧を返す関数


-- =====================================================================
-- Storage：timelines バケット（非公開）
-- ファイルは「ユーザー ID のフォルダ / 〇〇.json」に置く。取り込みが終わったら消す
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('timelines', 'timelines', false, 52428800, array['application/json'])
on conflict (id) do nothing;

-- storage.foldername(name) はパスをフォルダごとに分けた配列。[1] が一番上のフォルダ
create policy "自分のフォルダにタイムラインを置ける"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'timelines'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "自分のタイムラインを読める"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'timelines'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "自分のタイムラインを削除できる"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'timelines'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- =====================================================================
-- outings：同じ人・同じ開始時刻の外出は 1 件だけ
-- 取り込み直したときは上書き（upsert）になり、Jev の判定やメモは残る
-- =====================================================================
alter table public.outings
  add constraint outings_user_started_unique unique (user_id, started_at);


-- =====================================================================
-- 自分が行った県・国の一覧（地域ごとに、最初と最後に行った日、行った日数）
-- security invoker（既定）なので RLS がそのまま効く
-- =====================================================================
create function public.get_my_regions()
returns table (
  region_code text,
  first_visited_on date,
  last_visited_on date,
  visited_days bigint
)
language sql
stable
set search_path = ''
as $$
  select
    vr.region_code,
    min(vr.visited_on),
    max(vr.visited_on),
    count(distinct vr.visited_on)
  from public.visited_regions vr
  where vr.user_id = (select auth.uid())
  group by vr.region_code
  order by vr.region_code;
$$;

revoke execute on function public.get_my_regions() from public, anon;
grant execute on function public.get_my_regions() to authenticated;
