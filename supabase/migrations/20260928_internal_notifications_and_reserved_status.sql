-- Escola Conecta: notificações internas + padronização do slot reservado.
-- Executar no SQL Editor do Supabase se a branch atual ainda não tiver esta migração aplicada.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.lesson_bookings(id) on delete cascade,
  event_type text not null default 'system',
  title text not null,
  message text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_unique_event unique (recipient_id, booking_id, event_type)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

grant select, update on public.notifications to authenticated;

create or replace function public.enqueue_internal_lesson_notifications(p_booking_id uuid, p_event_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
  when_text text;
  event_title text;
begin
  select * into b from public.lesson_bookings where id = p_booking_id;
  if not found then return; end if;

  when_text := to_char(b.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
  event_title := case p_event_type
    when 'scheduled' then 'Nova aula agendada'
    when 'completed' then 'Aula realizada'
    when 'no_show' then 'Ausência registrada'
    else 'Atualização da aula'
  end;

  -- Aluno
  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (
    b.student_id, b.id, p_event_type,
    case when p_event_type = 'scheduled' then 'Aula agendada' else event_title end,
    case when p_event_type = 'scheduled'
      then format('Sua aula de %s foi agendada para %s.', b.subject, when_text)
      else format('%s — %s, %s.', event_title, b.subject, when_text)
    end,
    '/aulas/minhas'
  ) on conflict (recipient_id, booking_id, event_type) do nothing;

  -- Professor
  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (
    b.teacher_id, b.id, p_event_type,
    event_title,
    case when p_event_type = 'scheduled'
      then format('%s agendou %s para %s.', b.student_name, b.subject, when_text)
      else format('%s — aluno %s, %s, %s.', event_title, b.student_name, b.subject, when_text)
    end,
    '/aulas/minhas'
  ) on conflict (recipient_id, booking_id, event_type) do nothing;

  -- Administradores ativos
  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  select
    p.id, b.id, p_event_type,
    event_title,
    case when p_event_type = 'scheduled'
      then format('%s agendou %s para %s.', b.student_name, b.subject, when_text)
      else format('%s — aluno %s, %s, %s.', event_title, b.student_name, b.subject, when_text)
    end,
    '/admin/aulas'
  from public.profiles p
  where p.role = 'admin' and p.status = 'active'
  on conflict (recipient_id, booking_id, event_type) do nothing;
end $$;

revoke all on function public.enqueue_internal_lesson_notifications(uuid,text) from public, anon, authenticated;

-- A reserva usa o status aceito pelo banco: reserved.
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
 perform public.enqueue_internal_lesson_notifications(b,'scheduled');
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
 perform public.enqueue_internal_lesson_notifications(b.id,p_status);
end $$;
revoke all on function public.finish_escola_lesson(uuid,text,text) from public;
grant execute on function public.finish_escola_lesson(uuid,text,text) to authenticated;
