# Remarcação e cancelamento de aulas

1. No Supabase, abra **SQL Editor > New query**.
2. Execute todo o arquivo `supabase/migrations/20260928_lesson_reschedule_cancel.sql`.
3. Reinicie o Next.js.
4. Professor: **Minhas aulas > Gerenciar aula > Alterações da aula**.
5. Admin: **Aulas > Gerenciar aula > Alterações da aula**.

## Regras
- Somente professor responsável pela aula ou administrador pode remarcar/cancelar.
- Remarcação só usa outro horário `available` do mesmo professor.
- Ao remarcar, o horário antigo volta a ficar disponível e o novo fica `reserved`.
- Ao cancelar uma aula futura, o horário volta a ficar disponível para nova reserva.
- Aluno, professor e administradores recebem notificação interna de remarcação/cancelamento.
- Aula realizada, ausência ou cancelada não pode ser remarcada/cancelada novamente.
