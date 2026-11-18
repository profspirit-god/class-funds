-- Class Funds update 2 (payments + paid lists). Run ONCE in Supabase > SQL Editor, after update.sql.
create table if not exists cf_payments(id bigserial primary key, sid text not null, name text, label text not null, amount numeric not null check (amount>0),
  paid_on date not null default current_date, note text, by_name text, in_excel boolean not null default false, undone boolean not null default false, created_at timestamptz default now());
alter table cf_payments enable row level security;
drop policy if exists pay_admin on cf_payments; create policy pay_admin on cf_payments for select using (cf_is_admin());
insert into cf_perms(role,perm,allowed) values ('officer','paid_list',true),('officer','record_payments',false) on conflict do nothing;
create or replace function cf_my_perms() returns text[] language sql security definer stable set search_path=public as $$
  select coalesce(array_agg(p),'{}') from unnest(array['chat','officer_dash','data_export','data_import','manage_roles','record_payments','paid_list']) p where cf_perm(p) $$;

create or replace function cf_apply(p_sid text,p_label text,p_amt numeric) returns void language plpgsql security definer set search_path=public as $$
declare v jsonb; f jsonb;
begin
  if exists(select 1 from cf_students s,jsonb_array_elements(s.items) e where s.sid=p_sid and e->>'l'=p_label) then
    update cf_students set updated_at=now(), items=(select jsonb_agg(case when e->>'l'=p_label then jsonb_set(e,'{paid}',to_jsonb(coalesce((e->>'paid')::numeric,0)+p_amt)) else e end order by o) from jsonb_array_elements(items) with ordinality t(e,o)) where sid=p_sid;
  else
    update cf_students set updated_at=now(), items=items||jsonb_build_array(jsonb_build_object('l',p_label,'due',0,'paid',p_amt)) where sid=p_sid;
  end if;
  select summary into v from cf_config where id=1;
  if v->'fund' is not null then
    f:=v->'fund';
    f:=f||jsonb_build_object('cash',coalesce((f->>'cash')::numeric,0)+p_amt,'collected',coalesce((f->>'collected')::numeric,0)+p_amt,'outstanding',greatest(coalesce((f->>'outstanding')::numeric,0)-p_amt,0));
    v:=jsonb_set(v,'{fund}',f);
    v:=jsonb_set(v,'{cols}',(select coalesce(jsonb_agg(case when c->>'l'=p_label then c||jsonb_build_object('col',coalesce((c->>'col')::numeric,0)+p_amt,'out',greatest(coalesce((c->>'out')::numeric,0)-p_amt,0),
      'unpaid',(select count(*) from cf_students s,jsonb_array_elements(s.items) e where e->>'l'=p_label and (e->>'due')::numeric>(e->>'paid')::numeric)) else c end order by o),'[]'::jsonb) from jsonb_array_elements(v->'cols') with ordinality t(c,o)));
    v:=jsonb_set(v,'{stu}',jsonb_build_object('owing',(select count(*) from cf_students s where exists(select 1 from jsonb_array_elements(s.items) e where (e->>'due')::numeric>(e->>'paid')::numeric))));
    update cf_config set summary=v where id=1;
  end if;
end $$;
revoke execute on function cf_apply(text,text,numeric) from public, anon, authenticated;

create or replace function cf_find(p_q text) returns json language plpgsql security definer stable set search_path=public as $$
declare d text:=regexp_replace(p_q,'\D','','g');
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  if length(trim(p_q))<2 then return '[]'::json; end if;
  return (select coalesce(json_agg(json_build_object('sid',sid,'sid_show',sid_show,'name',name,'items',items) order by name),'[]'::json)
    from (select * from cf_students where name ilike '%'||trim(p_q)||'%' or (d<>'' and sid like '%'||d||'%') order by name limit 8) t); end $$;
create or replace function cf_record(p_sid text,p_label text,p_amount numeric,p_date date,p_note text) returns bigint language plpgsql security definer set search_path=public as $$
declare nm text; sn text; i bigint;
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'amount must be above zero'; end if;
  select name into sn from cf_students where sid=p_sid; if sn is null then raise exception 'student not found'; end if;
  select name into nm from cf_profiles where user_id=auth.uid();
  perform cf_apply(p_sid,p_label,p_amount);
  insert into cf_payments(sid,name,label,amount,paid_on,note,by_name) values (p_sid,sn,p_label,p_amount,coalesce(p_date,current_date),left(p_note,200),nm) returning id into i;
  return i; end $$;
create or replace function cf_undo(p_id bigint) returns void language plpgsql security definer set search_path=public as $$
declare r cf_payments;
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  select * into r from cf_payments where id=p_id; if r.id is null or r.undone then raise exception 'not found'; end if;
  if r.in_excel then raise exception 'already marked as in Excel'; end if;
  perform cf_apply(r.sid,r.label,-r.amount); update cf_payments set undone=true where id=p_id; end $$;
create or replace function cf_pay_log() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  return json_build_object('recent',(select coalesce(json_agg(x),'[]'::json) from (select id,sid,name,label,amount,paid_on,by_name,in_excel,undone from cf_payments order by id desc limit 40) x),
    'unsynced',(select count(*) from cf_payments where not in_excel and not undone)); end $$;
create or replace function cf_unsynced() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  return (select coalesce(json_agg(x order by id),'[]'::json) from (select p.id,s.sid_show,p.name,p.label,p.amount,p.paid_on from cf_payments p left join cf_students s on s.sid=p.sid where not p.in_excel and not p.undone) x); end $$;
create or replace function cf_mark_synced() returns void language plpgsql security definer set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if; update cf_payments set in_excel=true where not in_excel and not undone; end $$;
create or replace function cf_paid_list(p_label text,p_partial boolean) returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('paid_list') then raise exception 'no access'; end if;
  return (select coalesce(json_agg(json_build_object('name',name,'sid',sid_show,'due',(e->>'due')::numeric,'paid',(e->>'paid')::numeric) order by name),'[]'::json)
    from cf_students s,jsonb_array_elements(s.items) e where e->>'l'=p_label and (e->>'due')::numeric>0
      and ((e->>'paid')::numeric>=(e->>'due')::numeric or (p_partial and (e->>'paid')::numeric>0))); end $$;
drop function if exists cf_import(jsonb,jsonb,text);
create or replace function cf_import(p_students jsonb,p_summary jsonb,p_as_of text,p_reapply boolean default true) returns int language plpgsql security definer set search_path=public as $$
declare r record; n int:=0;
begin if not cf_perm('data_import') then raise exception 'no access'; end if;
  delete from cf_students where sid is not null;
  insert into cf_students(sid,sid_show,name,status,items)
    select sid,sid_show,name,status,coalesce(items,'[]'::jsonb) from jsonb_to_recordset(p_students) as x(sid text,sid_show text,name text,status text,items jsonb);
  update cf_config set summary=p_summary, as_of=p_as_of where id=1;
  if p_reapply then
    for r in select sid,label,amount from cf_payments where not in_excel and not undone and sid in (select sid from cf_students) loop
      perform cf_apply(r.sid,r.label,r.amount); n:=n+1; end loop;
  end if;
  return n; end $$;
