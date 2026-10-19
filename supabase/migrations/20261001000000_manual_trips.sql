-- 手入力の旅に対応する
--   - outings に「どこから来たデータか」の印（source）を付ける
--     timeline: Timeline.json から取り込んだ外出 / manual: 自分で入力した旅
--   - 重複防止（同じ開始時刻は 1 件）を「取り込んだ外出」だけに効かせる。
--     手入力の旅は同じ日に始まるものが複数あってもよく、取り込み直しで上書きされることもない

alter table public.outings
  add column source text not null default 'timeline'
    check (source in ('timeline', 'manual'));

alter table public.outings
  drop constraint outings_user_started_unique;

-- 取り込んだ外出のときだけ開始時刻が入り、手入力の旅では null になる列。
-- unique 制約は null 同士をぶつからないものとして扱うので、手入力の旅は何件でも入る
alter table public.outings
  add column timeline_started_at timestamptz
    generated always as (case when source = 'timeline' then started_at end) stored;

alter table public.outings
  add constraint outings_user_timeline_started_unique
    unique (user_id, timeline_started_at);
