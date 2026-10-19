-- Jev で外出を判定した結果を残すための列
--
--   label            旅行 / 帰省 / 日帰り / 日常（前からある列）
--   label_confidence Jev がその答えをどれくらい確かだと思っているか（0〜1）。人が決めたときは null
--   label_source     誰が決めたか。'jev' = Jev が判定 / 'user' = 本人が選んだ・直した
--
-- 一度 label が入った外出は Jev を呼び直さない（料金と利用上限の節約）。

alter table public.outings
  add column label_confidence real
    check (label_confidence is null or (label_confidence >= 0 and label_confidence <= 1)),
  add column label_source text
    check (label_source in ('jev', 'user'));

-- 手入力の旅は、本人が種類を選んでいる
update public.outings
set label_source = 'user'
where source = 'manual' and label is not null;
