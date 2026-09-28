-- Escola Conecta: histórico de aulas e desfechos separados da disponibilidade.
-- Aplicar APÓS as migrações de reservas/remarcação/cancelamento de 28/09/2026.

-- 1) Novo desfecho: ausência do professor.
alter table public.lesson_bookings
  drop constraint if exists lesson_bookings_status_check;

alter table public.lesson_bookings
  add constraint lesson_bookings_status_check
  check (status in ('scheduled','completed','no_show','teacher_no_show','cancelled'));

-- 2) Histórico imutável dos eventos importantes da aula.
create table if not exists public.lesson_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.lesson_bookings(id) on delete cascade,
  student_id uuid not null references auth.users(id),
  teacher_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('rescheduled','cancelled','completed','no_show','teacher_no_show')),
  subject text not null,
  grade_level text,
  student_name text not null,
  original_slot_id uuid,
  current_slot_id uuid,
  original_starts_at timestamptz,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  outcome_notes text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_events_teacher_time on public.lesson_events(teacher_id, created_at desc);
create index if not exists lesson_events_student_time on public.lesson_events(student_id, created_at desc);
create index if not exists lesson_events_booking on public.lesson_events(booking_id, created_at desc);

alter table public.lesson_events enable row level security;
drop policy if exists lesson_events_read on public.lesson_events;
create policy lesson_events_read on public.lesson_events for select to authenticated
using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_escola_admin());

grant select on public.lesson_events to authenticated;

-- 3) Trigger de auditoria: registra remarcações e desfechos sem perder o horário anterior.
create or replace function public.audit_lesson_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.starts_at is distinct from new.starts_at or old.slot_id is distinct from new.slot_id then
    insert into public.lesson_events(
      booking_id, student_id, teacher_id, event_type, subject, grade_level, student_name,
      original_slot_id, current_slot_id, original_starts_at, starts_at, ends_at, outcome_notes
    ) values (
      new.id, new.student_id, new.teacher_id, 'rescheduled', new.subject, new.grade_level, new.student_name,
      old.slot_id, new.slot_id, old.starts_at, new.starts_at, new.ends_at, new.outcome_notes
    );
  end if;

  if old.status is distinct from new.status and new.status in ('completed','no_show','teacher_no_show','cancelled') then
    insert into public.lesson_events(
      booking_id, student_id, teacher_id, event_type, subject, grade_level, student_name,
      original_slot_id, current_slot_id, original_starts_at, starts_at, ends_at, outcome_notes
    ) values (
      new.id, new.student_id, new.teacher_id, new.status, new.subject, new.grade_level, new.student_name,
      new.slot_id, new.slot_id, new.starts_at, new.starts_at, new.ends_at, new.outcome_notes
    );
  end if;

  return new;
end $$;

drop trigger if exists trg_lesson_history on public.lesson_bookings;
create trigger trg_lesson_history
after update on public.lesson_bookings
for each row execute function public.audit_lesson_history();

-- Backfill dos desfechos já existentes. Remarcações antigas não podem ser reconstruídas com segurança.
insert into public.lesson_events(
  booking_id, student_id, teacher_id, event_type, subject, grade_level, student_name,
  original_slot_id, current_slot_id, original_starts_at, starts_at, ends_at, outcome_notes, created_at
)
select
  b.id, b.student_id, b.teacher_id, b.status, b.subject, b.grade_level, b.student_name,
  b.slot_id, b.slot_id, b.starts_at, b.starts_at, b.ends_at, b.outcome_notes,
  coalesce(b.completed_at, b.created_at)
from public.lesson_bookings b
where b.status in ('completed','no_show','teacher_no_show','cancelled')
  and not exists (
    select 1 from public.lesson_events e
    where e.booking_id = b.id and e.event_type = b.status
  );

-- 4) Finalização passa a aceitar ausência do professor.
create or replace function public.finish_escola_lesson(p_booking_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.lesson_bookings%rowtype;
begin
 select * into b from public.lesson_bookings where id=p_booking_id for update;
 if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
  raise exception 'Acesso negado'; end if;
 if b.status <> 'scheduled' or b.starts_at > now() or p_status not in ('completed','no_show','teacher_no_show')
   or length(coalesce(p_notes,''))>1000 then raise exception 'Finalização inválida'; end if;
 update public.lesson_bookings
 set status=p_status, outcome_notes=nullif(trim(p_notes),''), completed_at=now()
 where id=b.id;
 perform public.enqueue_lesson_notifications(b.id,p_status);
 perform public.enqueue_internal_lesson_notifications(b.id,p_status);
end $$;
revoke all on function public.finish_escola_lesson(uuid,text,text) from public;
grant execute on function public.finish_escola_lesson(uuid,text,text) to authenticated;

-- 5) Cancelamento preserva o slot como encerrado: ele NÃO volta a aparecer como disponível.
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
  select * into b from public.lesson_bookings where id = p_booking_id for update;

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
  set status = 'cancelled', outcome_notes = nullif(trim(coalesce(p_reason,'')), ''), completed_at = now()
  where id = b.id;

  update public.availability_slots set status = 'cancelled' where id = b.slot_id;

  perform public.enqueue_lesson_notifications(b.id, 'cancelled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'cancelled');
end $$;
revoke all on function public.cancel_escola_lesson(uuid,text) from public, anon;
grant execute on function public.cancel_escola_lesson(uuid,text) to authenticated;

-- 6) Remarcação direta: o horário antigo fica encerrado e o novo fica reservado.
create or replace function public.reschedule_escola_lesson_direct(
  p_booking_id uuid,
  p_new_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
  old_slot public.availability_slots%rowtype;
  target_slot public.availability_slots%rowtype;
  v_duration interval;
  v_new_ends_at timestamptz;
begin
  select * into b from public.lesson_bookings where id = p_booking_id for update;
  if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
    raise exception 'Acesso negado';
  end if;
  if b.status <> 'scheduled' then raise exception 'Somente aulas agendadas podem ser remarcadas'; end if;
  if b.starts_at <= now() then raise exception 'Aulas já iniciadas não podem ser remarcadas'; end if;
  if p_new_starts_at is null or p_new_starts_at <= now() then raise exception 'Escolha uma nova data e horário futuros'; end if;

  v_duration := b.ends_at - b.starts_at;
  v_new_ends_at := p_new_starts_at + v_duration;

  if exists (
    select 1 from public.lesson_bookings x
    where x.teacher_id = b.teacher_id and x.id <> b.id and x.status = 'scheduled'
      and x.starts_at < v_new_ends_at and x.ends_at > p_new_starts_at
  ) then raise exception 'O professor já possui outra aula nesse intervalo'; end if;

  select * into target_slot from public.availability_slots
  where teacher_id = b.teacher_id and status = 'available'
    and starts_at = p_new_starts_at and ends_at = v_new_ends_at
  limit 1 for update;

  if target_slot.id is null then
    begin
      insert into public.availability_slots(teacher_id, starts_at, ends_at, lesson_price, subject, grade_level, status)
      values (b.teacher_id, p_new_starts_at, v_new_ends_at, b.lesson_price, b.subject, b.grade_level, 'reserved')
      returning * into target_slot;
    exception when others then
      raise exception 'O novo horário entra em conflito com outro horário já cadastrado';
    end;
  else
    update public.availability_slots set status = 'reserved' where id = target_slot.id;
  end if;

  select * into old_slot from public.availability_slots where id = b.slot_id for update;

  update public.lesson_bookings
  set slot_id = target_slot.id, starts_at = p_new_starts_at, ends_at = v_new_ends_at
  where id = b.id;

  if old_slot.id is not null and old_slot.id <> target_slot.id then
    update public.availability_slots set status = 'cancelled' where id = old_slot.id;
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;
revoke all on function public.reschedule_escola_lesson_direct(uuid,timestamptz) from public, anon;
grant execute on function public.reschedule_escola_lesson_direct(uuid,timestamptz) to authenticated;
