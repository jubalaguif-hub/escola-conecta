-- Escola Conecta — coerência entre aula e disponibilidade + janela de 40 minutos.
-- Aplicar APÓS 20260928_lesson_history_and_outcomes.sql.
-- Regra de negócio:
--   * um horário livre pode ser reservado até 40 min após o início, nunca após o fim;
--   * cancelamento/remarcação libera o horário antigo para novos interessados;
--   * depois da janela, a UI passa a tratá-lo como "Não reservado";
--   * aula concluída/ausência fecha o slot e não volta para a agenda ativa;
--   * uma aula remarcada continua com status 'scheduled' na NOVA data; "Remarcada" é evento de histórico.

-- 1) Reserva com tolerância de até 40 minutos após o início.
create or replace function public.book_escola_lesson(
 p_slot_id uuid,p_student_name text,p_student_phone text,p_referral_source text,p_consent_notifications boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.availability_slots%rowtype; b uuid; v_deadline timestamptz;
begin
 if auth.uid() is null or not exists (
   select 1 from public.profiles where id=auth.uid() and role='student' and status='active'
 ) then raise exception 'Aluno sem acesso ativo'; end if;
 if length(trim(coalesce(p_student_name,''))) < 3 or length(p_student_name)>150
    or length(trim(coalesce(p_student_phone,''))) < 8 or length(p_student_phone)>30
    or p_referral_source not in ('Indicação','Instagram','Google','Panfleto','Outros')
    or p_consent_notifications is not true then raise exception 'Preencha os dados e o consentimento'; end if;

 select * into s from public.availability_slots where id=p_slot_id for update;
 v_deadline := least(s.starts_at + interval '40 minutes', s.ends_at);
 if not found or s.status <> 'available' or v_deadline < now() then
    raise exception 'Horário indisponível ou prazo de reserva encerrado'; end if;
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

-- 2) Finalização fecha definitivamente a disponibilidade daquele slot.
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

 update public.availability_slots set status='closed' where id=b.slot_id;

 perform public.enqueue_lesson_notifications(b.id,p_status);
 perform public.enqueue_internal_lesson_notifications(b.id,p_status);
end $$;
revoke all on function public.finish_escola_lesson(uuid,text,text) from public;
grant execute on function public.finish_escola_lesson(uuid,text,text) to authenticated;

-- 3) Cancelamento: a aula vira Cancelada, mas o slot volta a ser ofertado.
-- A UI e a função de reserva aplicam automaticamente a janela de +40 min.
create or replace function public.cancel_escola_lesson(
  p_booking_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare b public.lesson_bookings%rowtype;
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

  -- Libera para outro interessado. Se ninguém reservar até início + 40 min,
  -- a interface passa a mostrá-lo no histórico como "Não reservado".
  update public.availability_slots set status = 'available' where id = b.slot_id;

  perform public.enqueue_lesson_notifications(b.id, 'cancelled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'cancelled');
end $$;
revoke all on function public.cancel_escola_lesson(uuid,text) from public, anon;
grant execute on function public.cancel_escola_lesson(uuid,text) to authenticated;

-- 4) Remarcação: a mesma booking muda para a nova data e CONTINUA 'scheduled'.
-- O horário antigo volta a ficar disponível para outra pessoa.
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
  set slot_id = target_slot.id,
      starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      status = 'scheduled',
      completed_at = null
  where id = b.id;

  if old_slot.id is not null and old_slot.id <> target_slot.id then
    update public.availability_slots set status = 'available' where id = old_slot.id;
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;
revoke all on function public.reschedule_escola_lesson_direct(uuid,timestamptz) from public, anon;
grant execute on function public.reschedule_escola_lesson_direct(uuid,timestamptz) to authenticated;

-- 5) Corrige dados já produzidos pelo comportamento anterior.
-- Aulas concluídas/ausências: slot fechado.
update public.availability_slots s
set status = 'closed'
from public.lesson_bookings b
where b.slot_id = s.id
  and b.status in ('completed','no_show','teacher_no_show');

-- Aulas canceladas: slot novamente ofertável. O prazo real é calculado pela data/hora.
update public.availability_slots s
set status = 'available'
from public.lesson_bookings b
where b.slot_id = s.id
  and b.status = 'cancelled'
  and not exists (
    select 1 from public.lesson_bookings active_b
    where active_b.slot_id = s.id and active_b.status = 'scheduled'
  );

-- Slots antigos de remarcações feitas pela versão anterior também são liberados.
update public.availability_slots s
set status = 'available'
from public.lesson_events e
where e.event_type = 'rescheduled'
  and e.original_slot_id = s.id
  and e.original_slot_id is distinct from e.current_slot_id
  and not exists (
    select 1 from public.lesson_bookings active_b
    where active_b.slot_id = s.id and active_b.status = 'scheduled'
  );

-- Garante que o slot da aula ATUAL agendada esteja reservado.
update public.availability_slots s
set status = 'reserved'
from public.lesson_bookings b
where b.slot_id = s.id and b.status = 'scheduled';
