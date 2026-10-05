-- Financeiro por aula: o valor já é congelado em lesson_bookings no momento da reserva.
-- Esta migration adiciona somente o estado de pagamento e garante que uma remarcação
-- para um slot existente NÃO altere o valor originalmente contratado.

alter table public.lesson_bookings
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_at timestamptz;

alter table public.lesson_bookings
  drop constraint if exists lesson_bookings_payment_status_check;

alter table public.lesson_bookings
  add constraint lesson_bookings_payment_status_check
  check (payment_status in ('pending','paid'));

create index if not exists lesson_bookings_payment_status_idx
  on public.lesson_bookings(payment_status, starts_at);

-- Somente administradores podem alterar a situação financeira de uma aula.
create or replace function public.set_lesson_payment_status(
  p_booking_id uuid,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
begin
  if auth.uid() is null or not public.is_escola_admin() then
    raise exception 'Acesso negado';
  end if;

  if p_payment_status not in ('pending','paid') then
    raise exception 'Situação de pagamento inválida';
  end if;

  select * into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Aula não encontrada';
  end if;

  if b.status = 'cancelled' and p_payment_status = 'paid' then
    raise exception 'Aula cancelada não pode ser marcada como paga';
  end if;

  update public.lesson_bookings
  set payment_status = p_payment_status,
      paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else null end
  where id = p_booking_id;
end $$;

revoke all on function public.set_lesson_payment_status(uuid,text) from public, anon;
grant execute on function public.set_lesson_payment_status(uuid,text) to authenticated;

-- Recria a remarcação para slot existente preservando lesson_price do booking.
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

  if not found or new_slot.status <> 'available' or new_slot.ends_at <= now() then
    raise exception 'Novo horário indisponível';
  end if;

  if new_slot.teacher_id <> b.teacher_id then
    raise exception 'A remarcação deve permanecer com o mesmo professor';
  end if;

  if new_slot.id = b.slot_id then
    raise exception 'Selecione outro horário';
  end if;

  if exists (
    select 1 from public.lesson_bookings x
    where x.slot_id = new_slot.id and x.status = 'scheduled'
  ) then
    raise exception 'Novo horário já reservado';
  end if;

  if exists (
    select 1 from public.lesson_bookings x
    where x.teacher_id = b.teacher_id
      and x.id <> b.id
      and x.status = 'scheduled'
      and x.starts_at < new_slot.ends_at
      and x.ends_at > new_slot.starts_at
  ) then
    raise exception 'O professor já possui outra aula nesse intervalo';
  end if;

  select * into old_slot
  from public.availability_slots
  where id = b.slot_id
  for update;

  update public.lesson_bookings
  set slot_id = new_slot.id,
      subject = coalesce(new_slot.subject, b.subject),
      grade_level = coalesce(new_slot.grade_level, b.grade_level),
      starts_at = new_slot.starts_at,
      ends_at = new_slot.ends_at,
      -- lesson_price permanece o preço contratado na reserva original
      status = 'scheduled',
      completed_at = null
  where id = b.id;

  update public.availability_slots
  set status = 'reserved'
  where id = new_slot.id;

  if old_slot.id is not null and old_slot.id <> new_slot.id then
    update public.availability_slots s
    set status = 'available'
    where s.id = old_slot.id
      and s.ends_at > now()
      and not exists (
        select 1 from public.lesson_bookings active_b
        where active_b.slot_id = s.id and active_b.status = 'scheduled'
      );
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;

revoke all on function public.reschedule_escola_lesson(uuid,uuid) from public, anon;
grant execute on function public.reschedule_escola_lesson(uuid,uuid) to authenticated;
