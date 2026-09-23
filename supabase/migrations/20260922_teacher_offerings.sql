-- Execute no SQL Editor do projeto Supabase ANTES de publicar este código.
-- Migração aditiva: não exclui registros ou altera os agendamentos existentes.
alter table public.profiles
  add column if not exists teaching_offerings jsonb not null default '[]'::jsonb;

alter table public.availability_slots
  add column if not exists grade_level text;

-- Horários antigos permanecem válidos, com grade_level null.
-- Novos horários recebem o nível a partir do cadastro nível + matéria do professor.
-- A prevenção definitiva de reservas simultâneas requer restrição transacional
-- no banco conforme modelo de bookings do projeto; não é garantida apenas pela UI.
