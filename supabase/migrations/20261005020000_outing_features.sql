-- 「学校に行っただけの日」と「近場に遊びに行った日（おでかけ）」を分けるための変更
--
--   label に 'outing'（おでかけ：近場で遊ぶ・買い物・食事）を追加。旅の一覧・友達への共有には入れない
--   label_source に 'rule' を追加（いつもの場所だけの日を、Jev に聞かずにコードで日常と決めたもの）
--   features       外出ごとの数字（自宅から一番遠い地点の距離・いつもの場所 / ふだん行かない場所にいた時間など）。座標は入れない
--   jev_p_day_trip 「遠くへの日帰り旅行か？」に「はい」と答えた確率

alter table public.outings drop constraint outings_label_check;
alter table public.outings add constraint outings_label_check
  check (label in ('trip', 'homecoming', 'day_trip', 'outing', 'daily'));

alter table public.outings drop constraint outings_jev_label_check;
alter table public.outings add constraint outings_jev_label_check
  check (jev_label in ('trip', 'homecoming', 'day_trip', 'outing', 'daily'));

alter table public.outings drop constraint outings_label_source_check;
alter table public.outings add constraint outings_label_source_check
  check (label_source in ('jev', 'user', 'rule'));

alter table public.outings
  add column features jsonb,
  add column jev_p_day_trip real
    check (jev_p_day_trip is null or (jev_p_day_trip >= 0 and jev_p_day_trip <= 1));
