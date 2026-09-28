# Escola Conecta — correção do histórico e janela de reserva (+40 min)

Esta versão corrige o comportamento observado no Preview da branch `feature-historico-aulas`.

## Regra implementada

Para um horário de **14:00–15:00**:

- se uma aula for cancelada/remarcada antes do horário, o slot antigo volta a ficar **Disponível**;
- outro aluno pode reservar esse horário até **14:40**;
- às **14:40** encerra a janela de reserva (ou antes, se a aula tiver duração menor que 40 min);
- depois do limite, o slot livre sai da agenda ativa e aparece para professor/admin como **Não reservado**;
- aulas **Realizadas**, **Aluno ausente** ou **Professor ausente** fecham o slot e não reaparecem como disponíveis;
- ao aprovar uma remarcação, a aula passa imediatamente para a **nova data como Agendada** para aluno, professor e admin;
- **Remarcada** é preservado no histórico como evento, e não como o estado atual da aula.

## Arquivos a substituir/adicionar

Substitua os arquivos do patch na branch `feature-historico-aulas`.

Além dos arquivos já alterados pela primeira versão, esta versão também altera:

- `src/app/aulas/reservar/page.tsx`
- `src/app/dashboard/page.tsx`

E adiciona a migração corretiva:

- `supabase/migrations/20260928_lesson_availability_grace_40min.sql`

## Supabase

Depois de enviar os arquivos da branch, execute no **SQL Editor do Supabase** o conteúdo de:

`20260928_lesson_availability_grace_40min.sql`

Ela foi feita para ser aplicada depois da migração anterior de histórico.

## Teste recomendado no Preview

1. Criar horário 14:00–15:00.
2. Agendar uma aula nele.
3. Cancelar a aula antes das 14:00.
4. Confirmar que a aula consta como **Cancelada** em Minhas aulas e Admin.
5. Confirmar que o slot 14:00–15:00 voltou como **Disponível**.
6. Confirmar que a reserva continua possível até 14:40.
7. Após 14:40, confirmar que o slot não aparece mais na agenda ativa e aparece como **Não reservado** no histórico do professor/admin.
8. Fazer uma remarcação e aprová-la.
9. Confirmar que a nova data aparece como **Agendada** para aluno/professor/admin.
10. Confirmar que a data antiga aparece no histórico como **Remarcada** e, enquanto dentro da janela, pode ser reservada por outro aluno.
11. Marcar uma aula como **Aluno ausente** e confirmar que ela some da agenda ativa e mantém esse mesmo status em todas as telas.

**Não faça merge na `main` antes desses testes.**
