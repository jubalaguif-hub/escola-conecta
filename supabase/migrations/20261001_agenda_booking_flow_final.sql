-- Escola Conecta — correção consolidada do fluxo de agenda/aulas.
-- Esta migration deve ser aplicada por último.
-- Objetivos:
--   1. permitir reutilizar um horário quando a reserva anterior foi cancelada;
--   2. manter apenas uma reserva ATIVA (scheduled) por slot;
--   3. cancelamento futuro devolve o slot para available;
--   4. remarcação reserva o novo slot e libera o antigo;
--   5. conclusão/ausência fecha o slot;
--   6. reconciliar estados antigos que ficaram incoerentes.

-- ---------------------------------------------------------------------------
-- 1) UM SLOT PODE TER HISTÓRICO DE RESERVAS, MAS APENAS UMA RESERVA ATIVA
-- ---------------------------------------------------------------------------

alter table public.lesson_bookings
  drop constraint if exists lesson_bookings_slot_id_key;

drop index if exists public.lesson_bookings_active_slot_unique;

create unique index lesson_bookings_active_slot_unique
  on public.lesson_bookings(slot_id)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- 2) MARCAÇÃO DE AULA
--    Mantém a regra atual de tolerância de até 40 minutos após o início,
--    limitada pelo horário de término.
-- ---------------------------------------------------------------------------

create or replace function public.book_escola_lesson(
  p_slot_id uuid,
  p_student_name text,
  p_student_phone text,
  p_referral_source text,
  p_consent_notifications boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.availability_slots%rowtype;
  b uuid;
  v_deadline timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
      and status = 'active'
  ) then
    raise exception 'Aluno sem acesso ativo';
  end if;

  if length(trim(coalesce(p_student_name,''))) < 3
     or length(p_student_name) > 150
     or length(trim(coalesce(p_student_phone,''))) < 8
     or length(p_student_phone) > 30
     or p_referral_source not in ('Indicação','Instagram','Google','Panfleto','Outros')
     or p_consent_notifications is not true then
    raise exception 'Preencha os dados e o consentimento';
  end if;

  select *
  into s
  from public.availability_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'Horário não encontrado';
  end if;

  v_deadline := least(s.starts_at + interval '40 minutes', s.ends_at);

  if s.status <> 'available' or now() > v_deadline then
    raise exception 'Horário indisponível ou prazo de reserva encerrado';
  end if;

  if exists (
    select 1
    from public.lesson_bookings x
    where x.slot_id = s.id
      and x.status = 'scheduled'
  ) then
    raise exception 'Horário já reservado';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = s.teacher_id
      and role = 'teacher'
      and status = 'active'
  ) then
    raise exception 'Professor não disponível';
  end if;

  insert into public.lesson_bookings(
    slot_id,
    student_id,
    teacher_id,
    student_name,
    student_phone,
    referral_source,
    subject,
    grade_level,
    starts_at,
    ends_at,
    lesson_price,
    consent_notifications
  )
  values (
    s.id,
    auth.uid(),
    s.teacher_id,
    trim(p_student_name),
    trim(p_student_phone),
    p_referral_source,
    coalesce(s.subject,'Aula particular'),
    s.grade_level,
    s.starts_at,
    s.ends_at,
    s.lesson_price,
    true
  )
  returning id into b;

  update public.availability_slots
  set status = 'reserved'
  where id = s.id;

  perform public.enqueue_lesson_notifications(b, 'scheduled');
  perform public.enqueue_internal_lesson_notifications(b, 'scheduled');

  return b;
end $$;

revoke all on function public.book_escola_lesson(uuid,text,text,text,boolean) from public;
grant execute on function public.book_escola_lesson(uuid,text,text,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) CANCELAMENTO
--    O histórico fica na booking/eventos. O slot futuro volta a ficar livre.
-- ---------------------------------------------------------------------------

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
  select *
  into b
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
  set status = 'cancelled',
      outcome_notes = nullif(trim(coalesce(p_reason,'')), ''),
      completed_at = now()
  where id = b.id;

  -- Só libera se não existir outra booking ativa vinculada ao mesmo slot.
  update public.availability_slots s
  set status = 'available'
  where s.id = b.slot_id
    and s.starts_at > now()
    and not exists (
      select 1
      from public.lesson_bookings active_b
      where active_b.slot_id = s.id
        and active_b.status = 'scheduled'
    );

  perform public.enqueue_lesson_notifications(b.id, 'cancelled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'cancelled');
end $$;

revoke all on function public.cancel_escola_lesson(uuid,text) from public, anon;
grant execute on function public.cancel_escola_lesson(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) REMARCAÇÃO DIRETA POR DATA/HORA (PROFESSOR/ADMIN)
--    Mantém a mesma booking e, portanto, o mesmo histórico da aula.
-- ---------------------------------------------------------------------------

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
  select *
  into b
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

  if p_new_starts_at is null or p_new_starts_at <= now() then
    raise exception 'Escolha uma nova data e horário futuros';
  end if;

  if p_new_starts_at = b.starts_at then
    raise exception 'Escolha uma data ou horário diferente do atual';
  end if;

  v_duration := b.ends_at - b.starts_at;
  v_new_ends_at := p_new_starts_at + v_duration;

  -- Não permite sobreposição com outra aula ativa do professor.
  if exists (
    select 1
    from public.lesson_bookings x
    where x.teacher_id = b.teacher_id
      and x.id <> b.id
      and x.status = 'scheduled'
      and x.starts_at < v_new_ends_at
      and x.ends_at > p_new_starts_at
  ) then
    raise exception 'O professor já possui outra aula nesse intervalo';
  end if;

  -- Se já houver exatamente esse slot livre, reutiliza-o.
  select *
  into target_slot
  from public.availability_slots
  where teacher_id = b.teacher_id
    and status = 'available'
    and starts_at = p_new_starts_at
    and ends_at = v_new_ends_at
  limit 1
  for update;

  if target_slot.id is null then
    begin
      insert into public.availability_slots(
        teacher_id,
        starts_at,
        ends_at,
        lesson_price,
        subject,
        grade_level,
        status
      )
      values (
        b.teacher_id,
        p_new_starts_at,
        v_new_ends_at,
        b.lesson_price,
        b.subject,
        b.grade_level,
        'reserved'
      )
      returning * into target_slot;
    exception
      when unique_violation or exclusion_violation then
        raise exception 'O novo horário entra em conflito com outro horário já cadastrado';
    end;
  else
    -- Proteção adicional contra estado incoerente no banco.
    if exists (
      select 1
      from public.lesson_bookings x
      where x.slot_id = target_slot.id
        and x.status = 'scheduled'
        and x.id <> b.id
    ) then
      raise exception 'O novo horário já está reservado';
    end if;

    update public.availability_slots
    set status = 'reserved'
    where id = target_slot.id;
  end if;

  select *
  into old_slot
  from public.availability_slots
  where id = b.slot_id
  for update;

  update public.lesson_bookings
  set slot_id = target_slot.id,
      starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      status = 'scheduled',
      completed_at = null
  where id = b.id;

  -- O horário anterior volta para a agenda se ainda puder ser utilizado.
  if old_slot.id is not null and old_slot.id <> target_slot.id then
    update public.availability_slots s
    set status = 'available'
    where s.id = old_slot.id
      and s.ends_at > now()
      and not exists (
        select 1
        from public.lesson_bookings active_b
        where active_b.slot_id = s.id
          and active_b.status = 'scheduled'
      );
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;

revoke all on function public.reschedule_escola_lesson_direct(uuid,timestamptz) from public, anon;
grant execute on function public.reschedule_escola_lesson_direct(uuid,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) REMARCAÇÃO PARA UM SLOT EXISTENTE
-- ---------------------------------------------------------------------------

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
  select *
  into b
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

  select *
  into new_slot
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
    select 1
    from public.lesson_bookings x
    where x.slot_id = new_slot.id
      and x.status = 'scheduled'
  ) then
    raise exception 'Novo horário já reservado';
  end if;

  if exists (
    select 1
    from public.lesson_bookings x
    where x.teacher_id = b.teacher_id
      and x.id <> b.id
      and x.status = 'scheduled'
      and x.starts_at < new_slot.ends_at
      and x.ends_at > new_slot.starts_at
  ) then
    raise exception 'O professor já possui outra aula nesse intervalo';
  end if;

  select *
  into old_slot
  from public.availability_slots
  where id = b.slot_id
  for update;

  update public.lesson_bookings
  set slot_id = new_slot.id,
      subject = coalesce(new_slot.subject, b.subject),
      grade_level = coalesce(new_slot.grade_level, b.grade_level),
      starts_at = new_slot.starts_at,
      ends_at = new_slot.ends_at,
      lesson_price = new_slot.lesson_price,
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
        select 1
        from public.lesson_bookings active_b
        where active_b.slot_id = s.id
          and active_b.status = 'scheduled'
      );
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;

revoke all on function public.reschedule_escola_lesson(uuid,uuid) from public, anon;
grant execute on function public.reschedule_escola_lesson(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) FINALIZAÇÃO
-- ---------------------------------------------------------------------------

create or replace function public.finish_escola_lesson(
  p_booking_id uuid,
  p_status text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
begin
  select *
  into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found or (b.teacher_id <> auth.uid() and not public.is_escola_admin()) then
    raise exception 'Acesso negado';
  end if;

  if b.status <> 'scheduled'
     or b.starts_at > now()
     or p_status not in ('completed','no_show','teacher_no_show')
     or length(coalesce(p_notes,'')) > 1000 then
    raise exception 'Finalização inválida';
  end if;

  update public.lesson_bookings
  set status = p_status,
      outcome_notes = nullif(trim(coalesce(p_notes,'')), ''),
      completed_at = now()
  where id = b.id;

  update public.availability_slots
  set status = 'completed'
  where id = b.slot_id;

  perform public.enqueue_lesson_notifications(b.id, p_status);
  perform public.enqueue_internal_lesson_notifications(b.id, p_status);
end $$;

revoke all on function public.finish_escola_lesson(uuid,text,text) from public;
grant execute on function public.finish_escola_lesson(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) RECONCILIAÇÃO DE DADOS ANTIGOS
-- ---------------------------------------------------------------------------

-- Aulas ativas sempre reservam o seu slot atual.
update public.availability_slots s
set status = 'reserved'
from public.lesson_bookings b
where b.slot_id = s.id
  and b.status = 'scheduled';

-- Aulas concluídas/ausências fecham definitivamente o slot.
update public.availability_slots s
set status = 'completed'
from public.lesson_bookings b
where b.slot_id = s.id
  and b.status in ('completed','no_show','teacher_no_show')
  and not exists (
    select 1
    from public.lesson_bookings active_b
    where active_b.slot_id = s.id
      and active_b.status = 'scheduled'
  );

-- Cancelamentos futuros sem nova reserva ativa devolvem o slot à agenda.
update public.availability_slots s
set status = 'available'
where s.starts_at > now()
  and exists (
    select 1
    from public.lesson_bookings cancelled_b
    where cancelled_b.slot_id = s.id
      and cancelled_b.status = 'cancelled'
  )
  and not exists (
    select 1
    from public.lesson_bookings active_b
    where active_b.slot_id = s.id
      and active_b.status = 'scheduled'
  );

-- Slots antigos de remarcação também voltam a ficar disponíveis,
-- desde que ainda sejam futuros e não estejam atualmente reservados.
update public.availability_slots s
set status = 'available'
where s.starts_at > now()
  and exists (
    select 1
    from public.lesson_events e
    where e.event_type = 'rescheduled'
      and e.original_slot_id = s.id
      and e.original_slot_id is distinct from e.current_slot_id
  )
  and not exists (
    select 1
    from public.lesson_bookings active_b
    where active_b.slot_id = s.id
      and active_b.status = 'scheduled'
  );
