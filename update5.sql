-- Class Funds update 5: collections renamed to CBMA / ESO names + grouped paid list.
-- Run ONCE in Supabase > SQL Editor, after update4.sql. Safe to run twice. Your data is kept: every stored name is renamed in place.
-- Renames: Membership Fee -> CBMA Membership | Event Management – Initial -> ESO Membership Initial | Event Management – Additional -> ESO Membership Add
-- 0) Safety copy of your current data (row security ON with no policy = nobody can read these through the app/API; drop them later when you are happy).
create table if not exists cf_bak5_students as select * from cf_students;
create table if not exists cf_bak5_payments as select * from cf_payments;
create table if not exists cf_bak5_remits as select * from cf_remits;
create table if not exists cf_bak5_config as select * from cf_config;
create table if not exists cf_bak5_profiles as select * from cf_profiles;
alter table cf_bak5_students enable row level security; alter table cf_bak5_payments enable row level security; alter table cf_bak5_remits enable row level security;
alter table cf_bak5_config enable row level security; alter table cf_bak5_profiles enable row level security;
-- 1) Rename in place.
create or replace function cf_rn(t text) returns text language sql immutable as $$
  select case t when 'Membership Fee' then 'CBMA Membership' when 'Event Management – Initial' then 'ESO Membership Initial' when 'Event Management – Additional' then 'ESO Membership Add' else t end $$;
update cf_students set items=(select coalesce(jsonb_agg(jsonb_set(e,'{l}',to_jsonb(cf_rn(e->>'l'))) order by o),'[]'::jsonb) from jsonb_array_elements(items) with ordinality t(e,o)) where jsonb_typeof(items)='array';
update cf_payments set label=cf_rn(label);
update cf_remits set label=cf_rn(label);
update cf_config set summary=jsonb_set(summary,'{cols}',(select coalesce(jsonb_agg(jsonb_set(c,'{l}',to_jsonb(cf_rn(c->>'l'))) order by o),'[]'::jsonb) from jsonb_array_elements(summary->'cols') with ordinality t(c,o))) where jsonb_typeof(summary->'cols')='array';
update cf_config set hidden=(select coalesce(jsonb_agg(to_jsonb(cf_rn(x))),'[]'::jsonb) from jsonb_array_elements_text(hidden) x) where jsonb_typeof(hidden)='array';
update cf_config set dates=(select coalesce(jsonb_object_agg(cf_rn(k),v),'{}'::jsonb) from jsonb_each(dates) x(k,v)) where jsonb_typeof(dates)='object';
update cf_config set remit=(select coalesce(jsonb_object_agg(cf_rn(k),v),'{}'::jsonb) from jsonb_each(remit) x(k,v)) where jsonb_typeof(remit)='object';
update cf_config set remit=jsonb_build_object('ESO Membership Initial',100,'ESO Membership Add',100)||coalesce(remit,'{}'::jsonb);
update cf_config set current=cf_rn(current);
drop function if exists cf_rn(text);
-- 2) Data for the grouped paid list (students with any payment; the app groups it into CBMA / ESO / All).
create or replace function cf_paid_table() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('paid_list') then raise exception 'no access'; end if;
  return (select coalesce(json_agg(json_build_object('name',name,'sid',sid_show,'items',items) order by name),'[]'::json) from cf_students
    where exists(select 1 from jsonb_array_elements(items) e where coalesce((e->>'paid')::numeric,0)>0)); end $$;
-- To undo this update (only if something looks wrong): restore from the cf_bak5_* tables, e.g.
--   update cf_students s set items=b.items from cf_bak5_students b where b.sid=s.sid;
