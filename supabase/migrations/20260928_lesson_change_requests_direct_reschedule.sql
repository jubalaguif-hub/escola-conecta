-- Escola Conecta: solicitação de cancelamento/remarcação pelo aluno
-- e remarcação direta por data/horário para professor e administrador.

create table if not exists public.lesson_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.lesson_bookings(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('reschedule','cancel')),
  requested_starts_at timestamptz,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lesson_change_requests_booking_idx
  on public.lesson_change_requests(booking_id, created_at desc);
create index if not exists lesson_change_requests_pending_idx
  on public.lesson_change_requests(status, created_at desc);

alter table public.lesson_change_requests enable row level security;
drop policy if exists lesson_change_requests_read on public.lesson_change_requests;
create policy lesson_change_requests_read
on public.lesson_change_requests for select to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1 from public.lesson_bookings b
    where b.id = lesson_change_requests.booking_id and b.teacher_id = auth.uid()
  )
  or public.is_escola_admin()
);

grant select on public.lesson_change_requests to authenticated;

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

  if p_new_starts_at is null or p_new_starts_at <= now() then
    raise exception 'Escolha uma nova data e horário futuros';
  end if;

  v_duration := b.ends_at - b.starts_at;
  v_new_ends_at := p_new_starts_at + v_duration;

  if exists (
    select 1 from public.lesson_bookings x
    where x.teacher_id = b.teacher_id
      and x.id <> b.id
      and x.status = 'scheduled'
      and x.starts_at < v_new_ends_at
      and x.ends_at > p_new_starts_at
  ) then
    raise exception 'O professor já possui outra aula nesse intervalo';
  end if;

  select * into target_slot
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
        teacher_id, starts_at, ends_at, lesson_price, subject, grade_level, status
      ) values (
        b.teacher_id, p_new_starts_at, v_new_ends_at, b.lesson_price, b.subject, b.grade_level, 'reserved'
      ) returning * into target_slot;
    exception when others then
      raise exception 'O novo horário entra em conflito com outro horário já cadastrado';
    end;
  else
    update public.availability_slots set status = 'reserved' where id = target_slot.id;
  end if;

  select * into old_slot
  from public.availability_slots
  where id = b.slot_id
  for update;

  update public.lesson_bookings
  set
    slot_id = target_slot.id,
    starts_at = p_new_starts_at,
    ends_at = v_new_ends_at
  where id = b.id;

  if old_slot.id is not null and old_slot.id <> target_slot.id then
    update public.availability_slots
    set status = case when starts_at > now() then 'available' else status end
    where id = old_slot.id;
  end if;

  perform public.enqueue_lesson_notifications(b.id, 'rescheduled');
  perform public.enqueue_internal_lesson_notifications(b.id, 'rescheduled');
end $$;

revoke all on function public.reschedule_escola_lesson_direct(uuid,timestamptz) from public, anon;
grant execute on function public.reschedule_escola_lesson_direct(uuid,timestamptz) to authenticated;

create or replace function public.request_lesson_change(
  p_booking_id uuid,
  p_request_type text,
  p_requested_starts_at timestamptz default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
  r_id uuid;
  v_event_type text;
  v_message text;
begin
  select * into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found or b.student_id <> auth.uid() then
    raise exception 'Acesso negado';
  end if;

  if b.status <> 'scheduled' or b.starts_at <= now() then
    raise exception 'Esta aula não aceita mais solicitação de alteração';
  end if;

  if p_request_type not in ('reschedule','cancel') then
    raise exception 'Tipo de solicitação inválido';
  end if;

  if p_request_type = 'reschedule' and (p_requested_starts_at is null or p_requested_starts_at <= now()) then
    raise exception 'Informe uma nova data e horário futuros';
  end if;

  if length(coalesce(p_reason,'')) > 500 then
    raise exception 'Motivo muito longo';
  end if;

  if exists (
    select 1 from public.lesson_change_requests
    where booking_id = b.id and status = 'pending'
  ) then
    raise exception 'Já existe uma solicitação pendente para esta aula';
  end if;

  insert into public.lesson_change_requests(
    booking_id, requester_id, request_type, requested_starts_at, reason
  ) values (
    b.id, auth.uid(), p_request_type, p_requested_starts_at, nullif(trim(coalesce(p_reason,'')), '')
  ) returning id into r_id;

  v_event_type := 'change_request:' || r_id::text;
  v_message := case p_request_type
    when 'reschedule' then format('%s solicitou remarcar %s para %s.', b.student_name, b.subject,
      to_char(p_requested_starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI'))
    else format('%s solicitou o cancelamento de %s.', b.student_name, b.subject)
  end;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (b.teacher_id, b.id, v_event_type, 'Solicitação do aluno', v_message, '/aulas/minhas')
  on conflict do nothing;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  select p.id, b.id, v_event_type, 'Solicitação do aluno', v_message, '/admin/aulas'
  from public.profiles p
  where p.role = 'admin' and p.status = 'active'
  on conflict do nothing;

  return r_id;
end $$;

revoke all on function public.request_lesson_change(uuid,text,timestamptz,text) from public, anon;
grant execute on function public.request_lesson_change(uuid,text,timestamptz,text) to authenticated;

create or replace function public.review_lesson_change_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.lesson_change_requests%rowtype;
  b public.lesson_bookings%rowtype;
  v_title text;
  v_message text;
begin
  select * into r
  from public.lesson_change_requests
  where id = p_request_id
  for update;

  if not found or r.status <> 'pending' then
    raise exception 'Solicitação não encontrada ou já analisada';
  end if;

  select * into b from public.lesson_bookings where id = r.booking_id;

  if b.teacher_id <> auth.uid() and not public.is_escola_admin() then
    raise exception 'Acesso negado';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'Decisão inválida';
  end if;

  if p_decision = 'approved' then
    if r.request_type = 'reschedule' then
      perform public.reschedule_escola_lesson_direct(r.booking_id, r.requested_starts_at);
    else
      perform public.cancel_escola_lesson(r.booking_id, coalesce(r.reason, 'Cancelamento solicitado pelo aluno'));
    end if;
  end if;

  update public.lesson_change_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      review_note = nullif(trim(coalesce(p_review_note,'')), ''),
      reviewed_at = now()
  where id = r.id;

  v_title := case when p_decision = 'approved' then 'Solicitação aprovada' else 'Solicitação não aprovada' end;
  v_message := case
    when p_decision = 'approved' and r.request_type = 'reschedule' then 'Sua solicitação de remarcação foi aprovada.'
    when p_decision = 'approved' and r.request_type = 'cancel' then 'Sua solicitação de cancelamento foi aprovada.'
    when r.request_type = 'reschedule' then 'Sua solicitação de remarcação não foi aprovada.'
    else 'Sua solicitação de cancelamento não foi aprovada.'
  end;

  insert into public.notifications(recipient_id, booking_id, event_type, title, message, href)
  values (r.requester_id, r.booking_id, 'change_request_review:' || r.id::text, v_title, v_message, '/aulas/minhas')
  on conflict do nothing;
end $$;

revoke all on function public.review_lesson_change_request(uuid,text,text) from public, anon;
grant execute on function public.review_lesson_change_request(uuid,text,text) to authenticated;
