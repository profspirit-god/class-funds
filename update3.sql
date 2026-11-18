-- Class Funds update 3 (remittance tracking). Run ONCE in Supabase > SQL Editor, after update2.sql.
alter table cf_config add column if not exists remit jsonb default '{"Membership Fee":100,"Activity Fee":100,"Intrams Day 1 Laro ng Lahi":100,"Intrams Day 2 Laro ng Lahi":100}';
create table if not exists cf_remits(id bigserial primary key, label text not null, amount numeric not null check (amount>0), sent_on date not null default current_date,
  note text, by_name text, in_excel boolean not null default false, undone boolean not null default false, created_at timestamptz default now());
alter table cf_remits enable row level security;
drop policy if exists remit_admin on cf_remits; create policy remit_admin on cf_remits for select using (cf_is_admin());
-- Opening amounts already remitted on Oct 16, 2026 (from your Excel note: Membership 1,000 + Activity 500 + Day 1 375 + Day 2 425). Already in Excel.
insert into cf_remits(label,amount,sent_on,note,by_name,in_excel)
  select v.* from (values ('Membership Fee',1000::numeric,date '2026-10-16','Opening: Oct 16 remittance to CBMA (from Excel)','import',true),
    ('Activity Fee',500::numeric,date '2026-10-16','Opening: Oct 16 remittance to CBMA (from Excel)','import',true),
    ('Intrams Day 1 Laro ng Lahi',375::numeric,date '2026-10-16','Opening: Oct 16 remittance to CBMA (from Excel)','import',true),
    ('Intrams Day 2 Laro ng Lahi',425::numeric,date '2026-10-16','Opening: Oct 16 remittance to CBMA (from Excel)','import',true)) v(label,amount,sent_on,note,by_name,in_excel)
  where not exists (select 1 from cf_remits);
insert into cf_perms(role,perm,allowed) values ('officer','remit',false) on conflict do nothing;
create or replace function cf_my_perms() returns text[] language sql security definer stable set search_path=public as $$
  select coalesce(array_agg(p),'{}') from unnest(array['chat','officer_dash','data_export','data_import','manage_roles','record_payments','paid_list','remit']) p where cf_perm(p) $$;

create or replace function cf_remit_apply(p_amt numeric) returns void language plpgsql security definer set search_path=public as $$
declare v jsonb; f jsonb;
begin select summary into v from cf_config where id=1;
  if v->'fund' is not null then
    f:=v->'fund'; f:=f||jsonb_build_object('cash',coalesce((f->>'cash')::numeric,0)-p_amt,'remitted',coalesce((f->>'remitted')::numeric,0)+p_amt);
    update cf_config set summary=jsonb_set(v,'{fund}',f) where id=1;
  end if; end $$;
revoke execute on function cf_remit_apply(numeric) from public, anon, authenticated;

create or replace function cf_remit(p_label text,p_amount numeric,p_date date,p_note text) returns bigint language plpgsql security definer set search_path=public as $$
declare nm text; i bigint;
begin if not cf_perm('remit') then raise exception 'no access'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'amount must be above zero'; end if;
  select name into nm from cf_profiles where user_id=auth.uid();
  insert into cf_remits(label,amount,sent_on,note,by_name) values (p_label,p_amount,coalesce(p_date,current_date),left(p_note,200),nm) returning id into i;
  perform cf_remit_apply(p_amount); return i; end $$;
create or replace function cf_remit_undo(p_id bigint) returns void language plpgsql security definer set search_path=public as $$
declare r cf_remits;
begin if not cf_perm('remit') then raise exception 'no access'; end if;
  select * into r from cf_remits where id=p_id; if r.id is null or r.undone then raise exception 'not found'; end if;
  if r.in_excel then raise exception 'already marked as in Excel'; end if;
  perform cf_remit_apply(-r.amount); update cf_remits set undone=true where id=p_id; end $$;
create or replace function cf_remit_log() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('remit') then raise exception 'no access'; end if;
  return (select coalesce(json_agg(x),'[]'::json) from (select id,label,amount,sent_on,note,by_name,in_excel,undone from cf_remits order by id desc limit 30) x); end $$;

create or replace function cf_overview() returns json language plpgsql security definer stable set search_path=public as $$
declare c cf_config;
begin if not cf_perm('officer_dash') then raise exception 'no access'; end if;
  select * into c from cf_config where id=1;
  return json_build_object('summary',c.summary,'current',c.current,'as_of',c.as_of,'remit',c.remit,
    'remitted',(select coalesce(jsonb_object_agg(label,s),'{}'::jsonb) from (select label,sum(amount) s from cf_remits where not undone group by label) x)); end $$;
create or replace function cf_pay_log() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  return json_build_object('recent',(select coalesce(json_agg(x),'[]'::json) from (select id,sid,name,label,amount,paid_on,by_name,in_excel,undone from cf_payments order by id desc limit 40) x),
    'unsynced',(select count(*) from cf_payments where not in_excel and not undone)+(select count(*) from cf_remits where not in_excel and not undone)); end $$;
create or replace function cf_unsynced() returns json language plpgsql security definer stable set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  return (select coalesce(json_agg(x order by kind,id),'[]'::json) from (
    select 'Payment'::text kind,p.id,s.sid_show,p.name,p.label,p.amount,p.paid_on d from cf_payments p left join cf_students s on s.sid=p.sid where not p.in_excel and not p.undone
    union all select 'Remittance',r.id,null::text,'CBMA remittance',r.label,r.amount,r.sent_on from cf_remits r where not r.in_excel and not r.undone) x); end $$;
create or replace function cf_mark_synced() returns void language plpgsql security definer set search_path=public as $$
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  update cf_payments set in_excel=true where not in_excel and not undone; update cf_remits set in_excel=true where not in_excel and not undone; end $$;
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
    for r in select amount from cf_remits where not in_excel and not undone loop perform cf_remit_apply(r.amount); n:=n+1; end loop;
  end if;
  return n; end $$;
