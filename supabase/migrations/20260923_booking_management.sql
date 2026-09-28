-- Execute no SQL Editor após backup e revisão das policies existentes.
-- Nunca execute antes de conferir a estrutura no seu projeto de produção.
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists notification_phone text;

-- Acesso imediato SOMENTE para a própria conta de aluno que está pendente.
-- Não libera professores, administradores ou contas bloqueadas.
create or replace function public.activate_my_student_profile()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set status = 'active'
  where id = auth.uid() and role = 'student' and status = 'pending';
  return exists (select 1 from public.profiles where id = auth.uid() and role='student' and status='active');
end $$;
revoke all on function public.activate_my_student_profile() from public;
grant execute on function public.activate_my_student_profile() to authenticated;

create table if not exists public.lesson_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.availability_slots(id) on delete restrict,
  student_id uuid not null references auth.users(id),
  teacher_id uuid not null references auth.users(id),
  student_name text not null,
  student_phone text not null,
  referral_source text not null check (referral_source in ('Indicação','Instagram','Google','Panfleto','Outros')),
  subject text not null,
  grade_level text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  lesson_price numeric not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','no_show','cancelled')),
  outcome_notes text,
  consent_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists lesson_bookings_student_time on public.lesson_bookings(student_id,starts_at);
create index if not exists lesson_bookings_teacher_time on public.lesson_bookings(teacher_id,starts_at);

create or replace function public.is_escola_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active');
$$;
revoke all on function public.is_escola_admin() from public;
grant execute on function public.is_escola_admin() to authenticated;

alter table public.lesson_bookings enable row level security;
drop policy if exists lesson_bookings_read on public.lesson_bookings;
create policy lesson_bookings_read on public.lesson_bookings for select to authenticated
using (student_id=auth.uid() or teacher_id=auth.uid() or public.is_escola_admin());
-- Não há policy de INSERT/UPDATE/DELETE: alterações apenas pelas RPCs verificadas.

create table if not exists public.lesson_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.lesson_bookings(id) on delete cascade,
  event_type text not null,
  recipient_role text not null check (recipient_role in ('student','teacher','admin')),
  channel text not null check (channel in ('email','whatsapp')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error_message text,
  sent_at timestamptz,
  unique (booking_id,event_type,recipient_role,channel)
);
alter table public.lesson_notification_deliveries enable row level security;
-- Sem policy de cliente; worker no servidor usa service role.

create or replace function public.enqueue_lesson_notifications(p_booking_id uuid, p_event_type text)
returns void language plpgsql security definer set search_path = '' as $$
declare r text; c text;
begin
  foreach r in array array['student','teacher','admin'] loop
    foreach c in array array['email','whatsapp'] loop
      insert into public.lesson_notification_deliveries(booking_id,event_type,recipient_role,channel)
      values(p_booking_id,p_event_type,r,c) on conflict do nothing;
    end loop;
  end loop;
end $$;
revoke all on function public.enqueue_lesson_notifications(uuid,text) from public,anon,authenticated;

-- Atomicidade: a linha do horário é bloqueada antes de registrar a aula.
-- O status do slot só muda após o INSERT, na mesma transação.
create or replace function public.book_escola_lesson(
 p_slot_id uuid,p_student_name text,p_student_phone text,p_referral_source text,p_consent_notifications boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.availability_slots%rowtype; b uuid;
begin
 if auth.uid() is null or not exists (
   select 1 from public.profiles where id=auth.uid() and role='student' and status='active'
 ) then raise exception 'Aluno sem acesso ativo'; end if;
 if length(trim(coalesce(p_student_name,''))) < 3 or length(p_student_name)>150
    or length(trim(coalesce(p_student_phone,''))) < 8 or length(p_student_phone)>30
    or p_referral_source not in ('Indicação','Instagram','Google','Panfleto','Outros')
    or p_consent_notifications is not true then raise exception 'Preencha os dados e o consentimento'; end if;
 select * into s from public.availability_slots where id=p_slot_id for update;
 if not found or s.status <> 'available' or s.starts_at <= now() then
    raise exception 'Horário indisponível ou já reservado'; end if;
 if not exists (select 1 from public.profiles where id=s.teacher_id and role='teacher' and status='active') then
    raise exception 'Professor não disponível'; end if;
 insert into public.lesson_bookings(slot_id,student_id,teacher_id,student_name,student_phone,
    referral_source,subject,grade_level,starts_at,ends_at,lesson_price,consent_notifications)
 values(s.id,auth.uid(),s.teacher_id,trim(p_student_name),trim(p_student_phone),p_referral_source,
    coalesce(s.subject,'Aula particular'),s.grade_level,s.starts_at,s.ends_at,s.lesson_price,true)
 returning id into b;
 update public.availability_slots set status='reserved' where id=s.id;
 perform public.enqueue_lesson_notifications(b,'scheduled');
 return b;
end $$;
revoke all on function public.book_escola_lesson(uuid,text,text,text,boolean) from public;
grant execute on function public.book_escola_lesson(uuid,text,text,text,boolean) to authenticated;

create or replace function public.finish_escola_lesson(p_booking_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.lesson_bookings%rowtype;
begin
 select * into b from public.lesson_bookings where id=p_booking_id for update;
 if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
  raise exception 'Acesso negado'; end if;
 if b.status <> 'scheduled' or b.starts_at > now() or p_status not in ('completed','no_show')
   or length(coalesce(p_notes,''))>1000 then raise exception 'Finalização inválida'; end if;
 update public.lesson_bookings set status=p_status, outcome_notes=nullif(trim(p_notes),''),completed_at=now() where id=b.id;
 perform public.enqueue_lesson_notifications(b.id,p_status);
end $$;
revoke all on function public.finish_escola_lesson(uuid,text,text) from public;
grant execute on function public.finish_escola_lesson(uuid,text,text) to authenticated;

-- Concessões explícitas necessárias em projetos onde o privilégio padrão foi revogado.
grant select on public.lesson_bookings to authenticated;
