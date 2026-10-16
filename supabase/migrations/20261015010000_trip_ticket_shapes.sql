-- 旅の切符でも、搭乗券・新幹線の切符の形を選べるようにする（10/15）
--   pass-classic など = 搭乗券の形、rail-mint など = 新幹線の切符の形

alter table public.outings drop constraint outings_ticket_design_check;
alter table public.outings
  add constraint outings_ticket_design_check
    check (ticket_design in (
      'atlas', 'mint', 'sky', 'retro', 'noir',
      'pass-classic', 'pass-mono', 'pass-sand', 'pass-noir',
      'rail-mint', 'rail-sky', 'rail-retro'
    ));
