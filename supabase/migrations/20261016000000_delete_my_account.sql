-- 本人がアカウントとデータを全部消せるようにする（10/16、公開に向けて）
--
--   auth.users の行を消すと、外出・行った県・便・乗車・友達・設定などはすべて on delete cascade で一緒に消える。
--   アプリには service_role の鍵を置かないので、本人の行だけを消すこの関数（security definer）を用意する。
--   消せるのは呼んだ本人（auth.uid()）だけ。タイムラインのファイルは、アプリが先に Storage から消す

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
