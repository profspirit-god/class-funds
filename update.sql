-- Class Funds update: run ONCE in Supabase > SQL Editor (after setup.sql). Safe on your existing data.
alter table cf_profiles drop constraint if exists cf_profiles_role_check;
alter table cf_profiles add constraint cf_profiles_role_check check (role in ('visitor','student','officer','admin'));
alter table cf_config add column if not exists current text default 'September class work';
alter table cf_config add column if not exists summary jsonb default '{}';
create table if not exists cf_perms(role text not null, perm text not null, allowed boolean not null default false, primary key(role,perm));
alter table cf_perms enable row level security;
drop policy if exists perms_all on cf_perms; create policy perms_all on cf_perms for all using (cf_is_admin()) with check (cf_is_admin());
insert into cf_perms(role,perm,allowed) values ('student','chat',true),('officer','chat',true),('officer','officer_dash',true),('officer','data_export',true),('officer','data_import',false),('officer','manage_roles',true) on conflict do nothing;
create or replace function cf_perm(p text) returns boolean language sql security definer stable set search_path=public as $$
  select cf_role()='admin' or coalesce((select allowed from cf_perms where role=cf_role() and perm=p),false) $$;
create or replace function cf_is_staff() returns boolean language sql security definer stable set search_path=public as $$ select coalesce(cf_role() in ('officer','admin'),false) $$;
create or replace function cf_my_perms() returns text[] language sql security definer stable set search_path=public as $$
  select coalesce(array_agg(p),'{}') from unnest(array['chat','officer_dash','data_export','data_import','manage_roles']) p where cf_perm(p) $$;
drop policy if exists p_sel on cf_profiles; create policy p_sel on cf_profiles for select using (user_id=auth.uid() or cf_is_staff());
drop policy if exists p_upd on cf_profiles;
create policy p_upd on cf_profiles for update
  using (cf_is_admin() or (cf_role()='officer' and cf_perm('manage_roles') and role in ('visitor','student')))
  with check (cf_is_admin() or (cf_role()='officer' and cf_perm('manage_roles') and role in ('visitor','student')));
drop policy if exists m_sel on cf_messages; drop policy if exists m_ins on cf_messages;
create policy m_sel on cf_messages for select using (thread=auth.uid() or cf_is_admin() or (thread='00000000-0000-0000-0000-00000000b011' and cf_is_staff()));
create policy m_ins on cf_messages for insert with check (sender=auth.uid() and is_admin=cf_is_admin() and (
  (thread=auth.uid() and cf_perm('chat')) or cf_is_admin() or (thread='00000000-0000-0000-0000-00000000b011' and cf_is_staff())));
create or replace function cf_overview() returns json language plpgsql security definer stable set search_path=public as $$
declare c cf_config;
begin if not cf_perm('officer_dash') then raise exception 'no access'; end if;
  select * into c from cf_config where id=1;
  return json_build_object('summary',c.summary,'current',c.current,'as_of',c.as_of); end $$;
create or replace function cf_export() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('data_export') then raise exception 'no access'; end if;
  return json_build_object('students',(select coalesce(json_agg(json_build_object('sid',sid,'sid_show',sid_show,'name',name,'status',status,'items',items) order by name),'[]'::json) from cf_students),
    'summary',(select summary from cf_config where id=1),'as_of',(select as_of from cf_config where id=1)); end $$;
create or replace function cf_import(p_students jsonb,p_summary jsonb,p_as_of text) returns void language plpgsql security definer set search_path=public as $$
begin if not cf_perm('data_import') then raise exception 'no access'; end if;
  delete from cf_students where sid is not null;
  insert into cf_students(sid,sid_show,name,status,items)
    select sid,sid_show,name,status,coalesce(items,'[]'::jsonb) from jsonb_to_recordset(p_students) as x(sid text,sid_show text,name text,status text,items jsonb);
  update cf_config set summary=p_summary, as_of=p_as_of where id=1; end $$;
