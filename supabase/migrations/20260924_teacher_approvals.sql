-- REVISAR/BACKUP ANTES DA EXECUCAO. Requer migrations 20260922 e 20260923.
-- Nao modifica professores existentes; so pedidos novos usam pending.
alter table public.profiles add column if not exists teacher_bio text;
alter table public.profiles add column if not exists teacher_education text;
alter table public.profiles add column if not exists teacher_experience text;
alter table public.profiles add column if not exists teacher_photo_url text;
alter table public.profiles add column if not exists teacher_requested_at timestamptz;
alter table public.profiles add column if not exists teacher_reviewed_at timestamptz;
create table if not exists public.teacher_approval_events (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.profiles(id),
 admin_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.teacher_approval_events enable row level security;
create policy teacher_approval_admin_read on public.teacher_approval_events
 for select to authenticated using(public.is_escola_admin());
-- SECURITY DEFINER: so proprio aluno ativo pode solicitar, nunca altera admin/conta bloqueada.
create or replace function public.request_teacher_profile(
 p_full_name text, p_education text, p_experience text, p_bio text,
 p_phone text, p_photo_url text, p_offerings jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare o jsonb; lvl text; subj text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='student' and status='active') then
  raise exception 'Apenas alunos ativos podem solicitar cadastro docente'; end if;
 if length(trim(coalesce(p_full_name,''))) not between 3 and 150 or length(coalesce(p_education,''))>1000
 or length(coalesce(p_experience,''))>1000 or length(coalesce(p_bio,''))>2000
 or length(trim(coalesce(p_phone,'')))<8 or length(p_phone)>30
 or length(coalesce(p_photo_url,''))>500
 or (p_photo_url<>'' and p_photo_url !~ '^https://')
 or jsonb_typeof(p_offerings) is distinct from 'array' or jsonb_array_length(p_offerings) not between 1 and 50
 then raise exception 'Revise os dados do perfil'; end if;
 for o in select value from jsonb_array_elements(p_offerings) loop
  lvl:=o->>'grade_level'; subj:=trim(coalesce(o->>'subject',''));
  if lvl is null or lvl not in ('Fundamental I','Fundamental II','Ensino Médio','Ensino Superior')
    or length(subj) not between 1 and 100 then raise exception 'Nivel ou disciplina invalida'; end if;
 end loop;
 update public.profiles set full_name=trim(p_full_name),role='teacher',status='pending',
   teacher_education=trim(p_education),teacher_experience=trim(p_experience),teacher_bio=trim(p_bio),
   notification_phone=trim(p_phone),teacher_photo_url=nullif(trim(p_photo_url),''),
   teaching_offerings=p_offerings,
   teaching_grade_levels=(select array_agg(distinct x->>'grade_level') from jsonb_array_elements(p_offerings) x),
   teaching_subjects=(select array_agg(distinct x->>'subject') from jsonb_array_elements(p_offerings) x),
   teacher_requested_at=now(),teacher_reviewed_at=null where id=auth.uid();
end $$;
revoke all on function public.request_teacher_profile(text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.request_teacher_profile(text,text,text,text,text,text,jsonb) to authenticated;
-- Decisao somente administrador ativo; status rejeitado = inactive, pode ser revisado.
create or replace function public.review_teacher_profile(p_teacher_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_escola_admin() or p_teacher_id=auth.uid() then raise exception 'Acesso negado'; end if;
 update public.profiles set status=case when p_approve then 'active' else 'inactive' end,
 teacher_reviewed_at=now()
 where id=p_teacher_id and role='teacher' and status='pending' and teacher_requested_at is not null;
 if not found then raise exception 'Solicitacao nao encontrada ou ja analisada'; end if;
 insert into public.teacher_approval_events(teacher_id,admin_id,decision)
 values(p_teacher_id,auth.uid(),case when p_approve then 'approved' else 'rejected' end);
end $$;
revoke all on function public.review_teacher_profile(uuid,boolean) from public,anon;
grant execute on function public.review_teacher_profile(uuid,boolean) to authenticated;
