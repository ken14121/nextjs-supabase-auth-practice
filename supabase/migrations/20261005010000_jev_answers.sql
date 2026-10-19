-- Jev の元の答えを、本人が直したあとも残しておく列（正解率と確率の当てはまりを測るため）
--
--   jev_label          Jev が出した種類（本人が直しても変わらない）
--   jev_confidence     その答えの確かさ（0〜1）
--   jev_p_daily        「日常か？」に「はい」と答えた確率
--   jev_p_homecoming   「帰省か？」に「はい」と答えた確率
--
-- 本人が確認したかどうかは label_source で分かる（'user' = 本人が「合ってる」を押した・直した）。

alter table public.outings
  add column jev_label text
    check (jev_label in ('trip', 'homecoming', 'day_trip', 'daily')),
  add column jev_confidence real
    check (jev_confidence is null or (jev_confidence >= 0 and jev_confidence <= 1)),
  add column jev_p_daily real
    check (jev_p_daily is null or (jev_p_daily >= 0 and jev_p_daily <= 1)),
  add column jev_p_homecoming real
    check (jev_p_homecoming is null or (jev_p_homecoming >= 0 and jev_p_homecoming <= 1));

-- すでに Jev が判定して、まだ本人が触っていないものは、今の答えを Jev の答えとして写しておく
-- （確率の生の値は残っていないので空のまま）
update public.outings
set jev_label = label, jev_confidence = label_confidence
where label_source = 'jev';
