# Solicitações do aluno e remarcação direta

1. Execute no SQL Editor do Supabase o arquivo:
   `supabase/migrations/20260928_lesson_change_requests_direct_reschedule.sql`
2. Reinicie o projeto.

## Regras desta versão
- Professor e administrador podem remarcar diretamente escolhendo data e horário.
- A remarcação mantém professor, matéria, nível, duração, valor e link online.
- Não é necessário criar disponibilidade antes.
- O sistema bloqueia conflito com outra aula agendada do professor.
- Aluno pode solicitar remarcação escolhendo data/horário ou solicitar cancelamento.
- A solicitação do aluno fica pendente para aprovação do professor da aula ou administrador.
- Professor e administrador recebem notificação interna da solicitação.
- Ao aprovar ou rejeitar, o aluno recebe notificação interna.
