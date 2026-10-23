-- 本人が確かめた外出（label_source = 'user'）を、ルールの検証用に 1 つの JSON で取り出す。
-- Supabase の SQL Editor で、下の me の UID（00000000-…）を自分のもの（Authentication → Users）に変えて実行する。
--
-- 入るもの：外出ごとの日時・泊数・距離・材料（features）・本人の答え・Jev の答えと確率・行った県と国のコード、
--           県・国ごとの行った日数、帰省の設定
-- 入らないもの：座標、市区町村、メールアドレス、名前、外出の ID
--
-- 取り出した結果はリポジトリに入れない（docs/research/jev-report.md の検証に使うだけ）
with me as (
  select '00000000-0000-0000-0000-000000000000'::uuid as id
),
regions as (
  select vr.region_code, count(distinct vr.visited_on) as visited_days
  from public.visited_regions vr
  where vr.user_id = (select id from me)
  group by vr.region_code
),
reviewed as (
  select
    o.started_at,
    o.ended_at,
    o.nights,
    o.distance_km,
    o.features,
    o.label,
    o.jev_label,
    o.jev_confidence,
    o.jev_p_daily,
    o.jev_p_homecoming,
    o.jev_p_day_trip,
    coalesce(
      (
        select array_agg(distinct vr.region_code)
        from public.visited_regions vr
        where vr.outing_id = o.id
      ),
      '{}'
    ) as region_codes
  from public.outings o
  where o.user_id = (select id from me)
    and o.source = 'timeline'
    and o.label_source = 'user'
)
select json_build_object(
  'homecoming', coalesce(
    (select js.homecoming from public.judge_settings js where js.user_id = (select id from me)),
    true
  ),
  'regions', coalesce((select json_agg(r order by r.region_code) from regions r), '[]'),
  'outings', coalesce((select json_agg(o order by o.started_at) from reviewed o), '[]')
) as export;
