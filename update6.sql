-- Class Funds update 6: import no longer double-counts payments/remittances that your Excel already contains.
-- Run ONCE in Supabase > SQL Editor, after update5.sql. Safe to run twice. Only replaces the function cf_import (no data is changed by running this file).
create or replace function cf_import(p_students jsonb,p_summary jsonb,p_as_of text,p_reapply boolean default true) returns int language plpgsql security definer set search_path=public as $$
declare r record; n int:=0; prior jsonb; prior_rem numeric; new_rem numeric; un_rem numeric; pp numeric; np numeric; need numeric;
begin if not cf_perm('data_import') then raise exception 'no access'; end if;
  if p_students is null or jsonb_typeof(p_students)<>'array' or jsonb_array_length(p_students)=0 then raise exception 'bad file: no student list'; end if;
  if p_summary is null or jsonb_typeof(p_summary)<>'object' or (p_summary->'cols' is not null and jsonb_typeof(p_summary->'cols')<>'array') then raise exception 'bad file: summary is malformed'; end if;
  if exists(select 1 from jsonb_array_elements(p_students) e where jsonb_typeof(e)<>'object' or coalesce(e->>'sid','') !~ '^[0-9]+$' or coalesce(e->>'name','')=''
       or jsonb_typeof(coalesce(e->'items','[]'::jsonb))<>'array') then raise exception 'bad file: a student row is malformed'; end if;
  if exists(select 1 from jsonb_array_elements(p_students) e,jsonb_array_elements(coalesce(e->'items','[]'::jsonb)) i where jsonb_typeof(i)<>'object' or coalesce(i->>'l','')=''
       or coalesce(i->>'due','x') !~ '^-?[0-9]+(\.[0-9]+)?$' or coalesce(i->>'paid','x') !~ '^-?[0-9]+(\.[0-9]+)?$') then raise exception 'bad file: an item has a bad amount'; end if;
  -- what the app showed BEFORE this import (per student + collection, and the remitted total)
  select coalesce(jsonb_object_agg(s.sid||'|'||(e->>'l'),coalesce((e->>'paid')::numeric,0)),'{}'::jsonb) into prior from cf_students s,jsonb_array_elements(s.items) e;
  select coalesce((summary->'fund'->>'remitted')::numeric,0) into prior_rem from cf_config where id=1;
  delete from cf_students where sid is not null;
  insert into cf_students(sid,sid_show,name,status,items)
    select sid,sid_show,name,status,coalesce(items,'[]'::jsonb) from jsonb_to_recordset(p_students) as x(sid text,sid_show text,name text,status text,items jsonb);
  update cf_config set summary=p_summary, as_of=p_as_of where id=1;
  if p_reapply then
    -- Payments recorded in the app but not yet marked as in Excel: add back ONLY what the new file is still missing.
    for r in select p.sid,p.label,sum(p.amount) amt from cf_payments p where not p.in_excel and not p.undone and p.sid in (select sid from cf_students) group by p.sid,p.label loop
      pp:=(prior->>(r.sid||'|'||r.label))::numeric;
      select coalesce((e->>'paid')::numeric,0) into np from cf_students s,jsonb_array_elements(s.items) e where s.sid=r.sid and e->>'l'=r.label;
      need:=least(r.amt,greatest(coalesce(pp,0)-coalesce(np,0),0));
      if need>0 then perform cf_apply(r.sid,r.label,need); n:=n+1; end if;
      if need=0 then update cf_payments set in_excel=true where sid=r.sid and label=r.label and not in_excel and not undone; end if;  -- the Excel already has them
    end loop;
    -- Remittances: same idea, compared with the Remitted total in the new file.
    select coalesce(sum(amount),0) into un_rem from cf_remits where not in_excel and not undone;
    if un_rem>0 then
      new_rem:=coalesce((p_summary->'fund'->>'remitted')::numeric,0);
      need:=least(un_rem,greatest(prior_rem-new_rem,0));
      if need>0 then perform cf_remit_apply(need); n:=n+1; end if;
      if need=0 then update cf_remits set in_excel=true where not in_excel and not undone; end if;
    end if;
  end if;
  return n; end $$;
