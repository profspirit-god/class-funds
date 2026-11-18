-- Class Funds update 4 (security + bug fixes from the attack test). Run ONCE in Supabase > SQL Editor, after update3.sql.
-- 1) Lost-update race: concurrent payments from two devices undercounted the officer totals. Lock the summary row.
create or replace function cf_apply(p_sid text,p_label text,p_amt numeric) returns void language plpgsql security definer set search_path=public as $$
declare v jsonb; f jsonb;
begin
  if exists(select 1 from cf_students s,jsonb_array_elements(s.items) e where s.sid=p_sid and e->>'l'=p_label) then
    update cf_students set updated_at=now(), items=(select jsonb_agg(case when e->>'l'=p_label then jsonb_set(e,'{paid}',to_jsonb(coalesce((e->>'paid')::numeric,0)+p_amt)) else e end order by o) from jsonb_array_elements(items) with ordinality t(e,o)) where sid=p_sid;
  else
    update cf_students set updated_at=now(), items=items||jsonb_build_array(jsonb_build_object('l',p_label,'due',0,'paid',p_amt)) where sid=p_sid;
  end if;
  select summary into v from cf_config where id=1 for update;
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
create or replace function cf_remit_apply(p_amt numeric) returns void language plpgsql security definer set search_path=public as $$
declare v jsonb; f jsonb;
begin select summary into v from cf_config where id=1 for update;
  if v->'fund' is not null then
    f:=v->'fund'; f:=f||jsonb_build_object('cash',coalesce((f->>'cash')::numeric,0)-p_amt,'remitted',coalesce((f->>'remitted')::numeric,0)+p_amt);
    update cf_config set summary=jsonb_set(v,'{fund}',f) where id=1;
  end if; end $$;
revoke execute on function cf_apply(text,text,numeric) from public, anon, authenticated;
revoke execute on function cf_remit_apply(numeric) from public, anon, authenticated;
-- 2) Only known collections can be recorded or remitted (no stray items).
create or replace function cf_record(p_sid text,p_label text,p_amount numeric,p_date date,p_note text) returns bigint language plpgsql security definer set search_path=public as $$
declare nm text; sn text; i bigint;
begin if not cf_perm('record_payments') then raise exception 'no access'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'amount must be above zero'; end if;
  if jsonb_typeof(coalesce((select summary->'cols' from cf_config where id=1),'null'::jsonb))='array'
     and not exists(select 1 from cf_config c,jsonb_array_elements(c.summary->'cols') x where x->>'l'=p_label) then raise exception 'unknown collection'; end if;
  select name into sn from cf_students where sid=p_sid; if sn is null then raise exception 'student not found'; end if;
  select name into nm from cf_profiles where user_id=auth.uid();
  perform cf_apply(p_sid,p_label,p_amount);
  insert into cf_payments(sid,name,label,amount,paid_on,note,by_name) values (p_sid,sn,p_label,p_amount,coalesce(p_date,current_date),left(p_note,200),nm) returning id into i;
  return i; end $$;
create or replace function cf_remit(p_label text,p_amount numeric,p_date date,p_note text) returns bigint language plpgsql security definer set search_path=public as $$
declare nm text; i bigint;
begin if not cf_perm('remit') then raise exception 'no access'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'amount must be above zero'; end if;
  if jsonb_typeof(coalesce((select summary->'cols' from cf_config where id=1),'null'::jsonb))='array'
     and not exists(select 1 from cf_config c,jsonb_array_elements(c.summary->'cols') x where x->>'l'=p_label) then raise exception 'unknown collection'; end if;
  select name into nm from cf_profiles where user_id=auth.uid();
  insert into cf_remits(label,amount,sent_on,note,by_name) values (p_label,p_amount,coalesce(p_date,current_date),left(p_note,200),nm) returning id into i;
  perform cf_remit_apply(p_amount); return i; end $$;
-- 3) Import validation: a malformed or empty file can no longer replace good data or break the Paid list.
create or replace function cf_import(p_students jsonb,p_summary jsonb,p_as_of text,p_reapply boolean default true) returns int language plpgsql security definer set search_path=public as $$
declare r record; n int:=0;
begin if not cf_perm('data_import') then raise exception 'no access'; end if;
  if p_students is null or jsonb_typeof(p_students)<>'array' or jsonb_array_length(p_students)=0 then raise exception 'bad file: no student list'; end if;
  if p_summary is null or jsonb_typeof(p_summary)<>'object' or (p_summary->'cols' is not null and jsonb_typeof(p_summary->'cols')<>'array') then raise exception 'bad file: summary is malformed'; end if;
  if exists(select 1 from jsonb_array_elements(p_students) e where jsonb_typeof(e)<>'object' or coalesce(e->>'sid','') !~ '^[0-9]+$' or coalesce(e->>'name','')=''
       or jsonb_typeof(coalesce(e->'items','[]'::jsonb))<>'array') then raise exception 'bad file: a student row is malformed'; end if;
  if exists(select 1 from jsonb_array_elements(p_students) e,jsonb_array_elements(coalesce(e->'items','[]'::jsonb)) i where jsonb_typeof(i)<>'object' or coalesce(i->>'l','')=''
       or coalesce(i->>'due','x') !~ '^-?[0-9]+(\.[0-9]+)?$' or coalesce(i->>'paid','x') !~ '^-?[0-9]+(\.[0-9]+)?$') then raise exception 'bad file: an item has a bad amount'; end if;
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
-- 4) Officers may change roles only (not names or IDs); admins cannot demote themselves by accident.
create or replace function cf_profile_guard() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and auth.uid() is not null then
    if not cf_is_admin() and auth.uid() is distinct from old.user_id and (new.name is distinct from old.name or new.sid is distinct from old.sid or new.user_id is distinct from old.user_id) then
      raise exception 'officers can only change roles'; end if;
    if old.role='admin' and new.role<>'admin' and auth.uid()=old.user_id then raise exception 'admins cannot demote themselves'; end if;
  end if; return new; end $$;
drop trigger if exists cf_profile_guard on cf_profiles;
create trigger cf_profile_guard before update on cf_profiles for each row execute function cf_profile_guard();
-- 5) Class-code guessing: 8 wrong tries lock that device for 15 minutes. Returns WRONG / LOCKED instead of raising so the count is kept.
create table if not exists cf_fails(uid uuid primary key, n int not null default 0, since timestamptz not null default now());
alter table cf_fails enable row level security;
create or replace function cf_register(p_name text,p_sid text,p_code text) returns text language plpgsql security definer set search_path=public as $$
declare ok boolean; r text; f cf_fails;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into f from cf_fails where uid=auth.uid();
  if f.uid is not null and f.since>now()-interval '15 minutes' and f.n>=8 then return 'LOCKED'; end if;
  select code_hash=encode(extensions.digest(p_code,'sha256'),'hex') into ok from cf_config where id=1;
  if not coalesce(ok,false) then
    insert into cf_fails(uid,n,since) values (auth.uid(),1,now()) on conflict (uid) do update
      set n=case when cf_fails.since>now()-interval '15 minutes' then cf_fails.n+1 else 1 end, since=case when cf_fails.since>now()-interval '15 minutes' then cf_fails.since else now() end;
    return 'WRONG';
  end if;
  delete from cf_fails where uid=auth.uid();
  insert into cf_profiles(user_id,name,sid) values (auth.uid(),left(trim(p_name),60),regexp_replace(p_sid,'\D','','g'))
  on conflict (user_id) do update set name=excluded.name, sid=excluded.sid;
  select role into r from cf_profiles where user_id=auth.uid(); return r;
end $$;
