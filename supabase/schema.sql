-- 새 프로젝트의 SQL Editor에서 실행합니다. 기존 테이블이 있다면 먼저 검토하세요.
create table public.tasks (
 id text not null default gen_random_uuid()::text check(length(id) between 1 and 100),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 150),
 description text not null default '' check(length(description)<=5000),
 status text not null default 'todo' check(status in ('todo','doing','done')),
 priority text not null default 'normal' check(priority in ('high','normal','low')),
 due date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
create index tasks_user_created_idx on public.tasks(user_id,created_at desc);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select,insert,update,delete on public.tasks to authenticated;
create policy own_tasks on public.tasks for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.touch_task() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
create trigger tasks_updated before update on public.tasks for each row execute function public.touch_task();
-- SECURITY INVOKER: 실행자의 RLS 유지. 실패하면 DELETE도 롤백됩니다.
create function public.replace_tasks(items jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if jsonb_typeof(items) <> 'array' or jsonb_array_length(items)>5000 then raise exception 'invalid backup';end if;
 delete from public.tasks where user_id=auth.uid();
 insert into public.tasks(id,user_id,title,description,status,priority,due,created_at)
 select x.id,auth.uid(),x.title,x.description,x.status,x.priority,x.due,x.created_at
 from jsonb_to_recordset(items) as x(id text,title text,description text,status text,priority text,due date,created_at timestamptz);
end;$$;
revoke all on function public.replace_tasks(jsonb) from public,anon;
grant execute on function public.replace_tasks(jsonb) to authenticated;
