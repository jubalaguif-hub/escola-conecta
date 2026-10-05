-- ESCOLA CONECTA - Financeiro por aula / PIX manual
-- O lesson_price já é congelado em lesson_bookings no momento da reserva.
-- Esta atualização adiciona baixa financeira manual pelo ADMIN e preserva o preço em remarcações.

alter table public.lesson_bookings
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_note text,
  add column if not exists payment_confirmed_by uuid references auth.users(id);

alter table public.lesson_bookings drop constraint if exists lesson_bookings_payment_status_check;
alter table public.lesson_bookings add constraint lesson_bookings_payment_status_check check (payment_status in ('pending','paid'));
alter table public.lesson_bookings drop constraint if exists lesson_bookings_payment_method_check;
alter table public.lesson_bookings add constraint lesson_bookings_payment_method_check check (payment_method is null or payment_method in ('pix','cash','card','transfer','other'));
create index if not exists lesson_bookings_payment_status_idx on public.lesson_bookings(payment_status, starts_at);

-- Remove a versão anterior para evitar ambiguidade no RPC.
drop function if exists public.set_lesson_payment_status(uuid,text);
drop function if exists public.set_lesson_payment_status(uuid,text,text,timestamptz,text);

create function public.set_lesson_payment_status(
  p_booking_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_paid_at timestamptz default null,
  p_payment_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.lesson_bookings%rowtype;
begin
  if auth.uid() is null or not public.is_escola_admin() then raise exception 'Acesso negado'; end if;
  if p_payment_status not in ('pending','paid') then raise exception 'Situação de pagamento inválida'; end if;
  if p_payment_method is not null and p_payment_method not in ('pix','cash','card','transfer','other') then raise exception 'Forma de pagamento inválida'; end if;
  if length(coalesce(p_payment_note,'')) > 500 then raise exception 'Observação muito longa'; end if;

  select * into b from public.lesson_bookings where id=p_booking_id for update;
  if not found then raise exception 'Aula não encontrada'; end if;
  if b.status in ('cancelled','teacher_no_show') and p_payment_status='paid' then raise exception 'Esta aula não deve ser cobrada'; end if;

  update public.lesson_bookings set
    payment_status=p_payment_status,
    paid_at=case when p_payment_status='paid' then coalesce(p_paid_at,now()) else null end,
    payment_method=case when p_payment_status='paid' then p_payment_method else null end,
    payment_note=case when p_payment_status='paid' then nullif(trim(coalesce(p_payment_note,'')),'') else null end,
    payment_confirmed_by=case when p_payment_status='paid' then auth.uid() else null end
  where id=p_booking_id;
end $$;

revoke all on function public.set_lesson_payment_status(uuid,text,text,timestamptz,text) from public, anon;
grant execute on function public.set_lesson_payment_status(uuid,text,text,timestamptz,text) to authenticated;

-- Remarcação preservando o preço contratado na reserva original.
create or replace function public.reschedule_escola_lesson(p_booking_id uuid,p_new_slot_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.lesson_bookings%rowtype; old_slot public.availability_slots%rowtype; new_slot public.availability_slots%rowtype;
begin
  select * into b from public.lesson_bookings where id=p_booking_id for update;
  if not found or (b.teacher_id<>auth.uid() and not public.is_escola_admin()) then raise exception 'Acesso negado'; end if;
  if b.status<>'scheduled' then raise exception 'Somente aulas agendadas podem ser remarcadas'; end if;
  if b.starts_at<=now() then raise exception 'Aulas já iniciadas não podem ser remarcadas'; end if;
  select * into new_slot from public.availability_slots where id=p_new_slot_id for update;
  if not found or new_slot.status<>'available' or new_slot.ends_at<=now() then raise exception 'Novo horário indisponível'; end if;
  if new_slot.teacher_id<>b.teacher_id then raise exception 'A remarcação deve permanecer com o mesmo professor'; end if;
  if new_slot.id=b.slot_id then raise exception 'Selecione outro horário'; end if;
  if exists(select 1 from public.lesson_bookings x where x.slot_id=new_slot.id and x.status='scheduled') then raise exception 'Novo horário já reservado'; end if;
  if exists(select 1 from public.lesson_bookings x where x.teacher_id=b.teacher_id and x.id<>b.id and x.status='scheduled' and x.starts_at<new_slot.ends_at and x.ends_at>new_slot.starts_at) then raise exception 'O professor já possui outra aula nesse intervalo'; end if;
  select * into old_slot from public.availability_slots where id=b.slot_id for update;
  update public.lesson_bookings set slot_id=new_slot.id,subject=coalesce(new_slot.subject,b.subject),grade_level=coalesce(new_slot.grade_level,b.grade_level),starts_at=new_slot.starts_at,ends_at=new_slot.ends_at,status='scheduled',completed_at=null where id=b.id;
  update public.availability_slots set status='reserved' where id=new_slot.id;
  if old_slot.id is not null and old_slot.id<>new_slot.id then update public.availability_slots s set status='available' where s.id=old_slot.id and s.ends_at>now() and not exists(select 1 from public.lesson_bookings active_b where active_b.slot_id=s.id and active_b.status='scheduled'); end if;
  perform public.enqueue_lesson_notifications(b.id,'rescheduled'); perform public.enqueue_internal_lesson_notifications(b.id,'rescheduled');
end $$;
revoke all on function public.reschedule_escola_lesson(uuid,uuid) from public, anon;
grant execute on function public.reschedule_escola_lesson(uuid,uuid) to authenticated;
