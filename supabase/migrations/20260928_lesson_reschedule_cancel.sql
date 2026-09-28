-- Escola Conecta: remarcação e cancelamento de aulas.
-- Execute após as migrações de reservas, notificações internas e link da aula online.

-- Permite reaproveitar um horário após cancelamento mantendo o histórico da reserva cancelada.
alter table public.lesson_bookings
  drop constraint if exists lesson_bookings_slot_id_key;

create unique index if not exists lesson_bookings_active_slot_unique
  on public.lesson_bookings(slot_id)
  where status <> 'cancelled';

-- Notificações de remarcação podem ocorrer mais de uma vez para a mesma aula.
alter table public.notifications
  drop constraint if exists notifications_unique_event;

create unique index if not exists notifications_unique_non_reschedule_event
  on public.notifications(recipient_id, booking_id, event_type)
  where event_type <> 'rescheduled';

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
  student_message text;
  teacher_message text;
begin
  select * into b from public.lesson_bookings where id = p_booking_id;
  if not found then return; end if;

  when_text := to_char(b.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
  event_title := case p_event_type
    when 'scheduled' then 'Nova aula agendada'
    when 'rescheduled' then 'Aula remarcada'
    when 'cancelled' then 'Aula cancelada'
    when 'completed' then 'Aula realizada'
    when 'no_show' then 'Ausência registrada'
    else 'Atualização da aula'
  end;

  student_message := case p_event_type
    when 'scheduled' then format('Sua aula de %s foi agendada para %s.', b.subject, when_text)
    when 'rescheduled' then format('Sua aula de %s foi remarcada para %s.', b.subject, when_text)
    when 'cancelled' then format('Sua aula de %s, prevista para %s, foi cancelada.', b.subject, when_text)
    else format('%s — %s, %s.', event_title, b.subject, when_text)
  end;

  teacher_message := case p_event_type
    when 'scheduled' then format('%s agendou %s para %s.', b.student_name, b.subject, when_text)
    when 'rescheduled' then format('A aula de %s (%s) foi remarcada para %s.', b.student_name, b.subject, when_text)
    when 'cancelled' then format('A aula de %s (%s), prevista para %s, foi cancelada.', b.student_name, b.subject, when_text)
    else format('%s — aluno %s, %s, %s.', event_title, b.student_name, b.subject, when_text)
  end;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (
    b.student_id, b.id, p_event_type,
    case when p_event_type = 'scheduled' then 'Aula agendada' else event_title end,
    student_message,
    '/aulas/minhas'
  ) on conflict do nothing;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (b.teacher_id, b.id, p_event_type, event_title, teacher_message, '/aulas/minhas')
  on conflict do nothing;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  select p.id, b.id, p_event_type, event_title, teacher_message, '/admin/aulas'
  from public.profiles p
  where p.role = 'admin' and p.status = 'active'
  on conflict do nothing;
end $$;

revoke all on function public.enqueue_internal_lesson_notifications(uuid,text)
from public, anon, authenticated;

create or replace function public.reschedule_escola_lesson(
  p_booking_id uuid,
  p_new_slot_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
  old_slot public.availability_slots%rowtype;
  new_slot public.availability_slots%rowtype;
begin
  select * into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
    raise exception 'Acesso negado';
  end if;

  if b.status <> 'scheduled' then
    raise exception 'Somente aulas agendadas podem ser remarcadas';
  end if;

  if b.starts_at <= now() then
    raise exception 'Aulas já iniciadas não podem ser remarcadas';
  end if;

  select * into new_slot
  from public.availability_slots
  where id = p_new_slot_id
  for update;

  if not found or new_slot.status <> 'available' or new_slot.starts_at <= now() then
    raise exception 'Novo horário indisponível';
  end if;

  if new_slot.teacher_id <> b.teacher_id then
    raise exception 'A remarcação deve permanecer com o mesmo professor';
  end if;

  if new_slot.id = b.slot_id then
    raise exception 'Selecione outro horário';
  end if;

  select * into old_slot
  from public.availability_slots
  where id = b.slot_id
  for update;

  update public.lesson_bookings
  set
    slot_id = new_slot.id,
    subject = coalesce(new_slot.subject, b.subject),
    grade_level = new_slot.grade_level,
    starts_at = new_slot.starts_at,
    ends_at = new_slot.ends_at,
    lesson_price = new_slot.lesson_price
  where id = b.id;

  update public.availability_slots
  set status = 'reserved'
  where id = new_slot.id;

  if old_slot.id is not null then
    update public.availability_slots
    set status = 'available'
    where id = old_slot.id;
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;

revoke all on function public.reschedule_escola_lesson(uuid,uuid) from public, anon;
grant execute on function public.reschedule_escola_lesson(uuid,uuid) to authenticated;

create or replace function public.cancel_escola_lesson(
  p_booking_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
begin
  select * into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
    raise exception 'Acesso negado';
  end if;

  if b.status <> 'scheduled' then
    raise exception 'Somente aulas agendadas podem ser canceladas';
  end if;

  if b.starts_at <= now() then
    raise exception 'Aulas já iniciadas não podem ser canceladas';
  end if;

  if length(coalesce(p_reason,'')) > 500 then
    raise exception 'Motivo do cancelamento muito longo';
  end if;

  update public.lesson_bookings
  set
    status = 'cancelled',
    outcome_notes = nullif(trim(coalesce(p_reason,'')), ''),
    completed_at = now()
  where id = b.id;

  update public.availability_slots
  set status = case when starts_at > now() then 'available' else 'cancelled' end
  where id = b.slot_id;

  perform public.enqueue_lesson_notifications(b.id, 'cancelled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'cancelled');
end $$;

revoke all on function public.cancel_escola_lesson(uuid,text) from public, anon;
grant execute on function public.cancel_escola_lesson(uuid,text) to authenticated;
