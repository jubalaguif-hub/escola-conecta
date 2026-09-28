-- Escola Conecta: link de aula online vinculado ao agendamento.
-- Pode ser aplicado após as migrações de booking/notificações.

alter table public.lesson_bookings
  add column if not exists meeting_url text,
  add column if not exists meeting_provider text;

create or replace function public.set_lesson_meeting_link(
  p_booking_id uuid,
  p_meeting_url text,
  p_provider text default 'Google Meet'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.lesson_bookings%rowtype;
  clean_url text := nullif(trim(coalesce(p_meeting_url,'')), '');
  clean_provider text := nullif(trim(coalesce(p_provider,'')), '');
begin
  select * into b
  from public.lesson_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Aula não encontrada';
  end if;

  if b.teacher_id <> auth.uid() and not public.is_escola_admin() then
    raise exception 'Acesso negado';
  end if;

  if clean_url is not null then
    if length(clean_url) > 500 or clean_url !~* '^https://[^[:space:]]+$' then
      raise exception 'Informe um link HTTPS válido';
    end if;
  end if;

  if clean_provider is not null and length(clean_provider) > 80 then
    raise exception 'Nome do provedor muito longo';
  end if;

  update public.lesson_bookings
  set meeting_url = clean_url,
      meeting_provider = case when clean_url is null then null else coalesce(clean_provider,'Aula online') end
  where id = p_booking_id;
end $$;

revoke all on function public.set_lesson_meeting_link(uuid,text,text) from public, anon;
grant execute on function public.set_lesson_meeting_link(uuid,text,text) to authenticated;
