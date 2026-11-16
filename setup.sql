-- Class Funds: run once in Supabase > SQL Editor. Tables are prefixed cf_ so it is safe in a project that already has other tables.
-- STEP 0: change CHANGE-ME below to your class code before running.
create extension if not exists pgcrypto with schema extensions;
create table cf_profiles(user_id uuid primary key references auth.users on delete cascade, name text not null, sid text not null, role text not null default 'visitor' check (role in ('visitor','student','admin')), created_at timestamptz default now());
create table cf_students(sid text primary key, sid_show text, name text, status text, items jsonb not null default '[]', updated_at timestamptz default now());
create table cf_config(id int primary key default 1 check (id=1), code_hash text not null, as_of text default '', announcement text default '', hidden jsonb default '[]', dates jsonb default '{}');
insert into cf_config(code_hash) values (encode(extensions.digest('0203','sha256'),'hex'));
create table cf_messages(id bigserial primary key, thread uuid not null, sender uuid not null default auth.uid(), sender_name text not null, is_admin boolean not null default false, body text not null check (length(body) between 1 and 1000), created_at timestamptz default now());
create function cf_role() returns text language sql security definer stable set search_path=public as $$ select role from cf_profiles where user_id=auth.uid() $$;
create function cf_is_admin() returns boolean language sql security definer stable set search_path=public as $$ select coalesce(cf_role()='admin',false) $$;
alter table cf_profiles enable row level security; alter table cf_students enable row level security; alter table cf_config enable row level security; alter table cf_messages enable row level security;
create policy p_sel on cf_profiles for select using (user_id=auth.uid() or cf_is_admin());
create policy p_upd on cf_profiles for update using (cf_is_admin()) with check (cf_is_admin());
create policy s_all on cf_students for all using (cf_is_admin()) with check (cf_is_admin());
create policy c_all on cf_config for all using (cf_is_admin()) with check (cf_is_admin());
create policy m_sel on cf_messages for select using (thread=auth.uid() or cf_is_admin());
create policy m_ins on cf_messages for insert with check (sender=auth.uid() and is_admin=cf_is_admin() and ((thread=auth.uid() and cf_role() in ('student','admin')) or cf_is_admin()));
create function cf_register(p_name text,p_sid text,p_code text) returns text language plpgsql security definer set search_path=public as $$
declare ok boolean; r text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select code_hash=encode(extensions.digest(p_code,'sha256'),'hex') into ok from cf_config where id=1;
  if not coalesce(ok,false) then raise exception 'wrong code'; end if;
  insert into cf_profiles(user_id,name,sid) values (auth.uid(),left(trim(p_name),60),regexp_replace(p_sid,'\D','','g'))
  on conflict (user_id) do update set name=excluded.name, sid=excluded.sid;
  select role into r from cf_profiles where user_id=auth.uid(); return r;
end $$;
create function cf_rename(p_name text,p_sid text) returns void language sql security definer set search_path=public as $$
  update cf_profiles set name=left(trim(p_name),60), sid=regexp_replace(p_sid,'\D','','g') where user_id=auth.uid() $$;
create function cf_lookup(p_sid text) returns json language plpgsql security definer stable set search_path=public as $$
declare s cf_students; c cf_config;
begin
  if cf_role() is null then raise exception 'not registered'; end if;
  select * into s from cf_students where sid=regexp_replace(p_sid,'\D','','g');
  select * into c from cf_config where id=1;
  return json_build_object('student', case when s.sid is null then null else json_build_object('sid',s.sid_show,'name',s.name,'status',s.status,'items',s.items) end,
    'as_of',c.as_of,'announcement',c.announcement,'hidden',c.hidden,'dates',c.dates);
end $$;
create function cf_set_code(p_code text) returns void language plpgsql security definer set search_path=public as $$
begin if not cf_is_admin() then raise exception 'admin only'; end if;
  update cf_config set code_hash=encode(extensions.digest(p_code,'sha256'),'hex') where id=1; end $$;
alter publication supabase_realtime add table cf_messages;
-- STEP 2 (after creating your admin user in Authentication > Users), run separately with YOUR email:
-- insert into cf_profiles(user_id,name,sid,role) select id,'Treasurer','000000','admin' from auth.users where email='YOUR-EMAIL@gmail.com';
