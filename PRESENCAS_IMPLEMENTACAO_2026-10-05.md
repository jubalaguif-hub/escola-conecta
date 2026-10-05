# Presenças — implementação 05/10/2026

## Implementado

- Professor: nova rota `/professor/presencas` e item **Minha presença** no menu.
- Admin: `/admin/presencas` substituído pelo protótipo fixo por dados reais de `lesson_bookings`.
- Filtros por mês e matéria para o professor.
- Filtros por mês, professor e matéria para o admin.
- Admin vê resumo de todos os professores ativos e pode abrir o detalhamento das aulas de um professor.
- Registro de resultado de aula invalida/revalida as páginas de presença.

## Regra de frequência do professor

- `completed` (aula realizada): professor **Presente**.
- `no_show` (aluno ausente): professor **Presente**.
- `teacher_no_show` (professor ausente): professor **Ausente**.
- `scheduled`: não entra no percentual enquanto não houver resultado.
- `cancelled`: não entra no percentual.

Percentual: `presenças / (presenças + ausências) * 100`.

## Banco de dados

Nenhuma migration nova foi criada. A implementação usa `lesson_bookings` e a RLS já existente: professor lê suas próprias aulas; admin lê todas.

## Validação local

A revisão estática do código foi realizada. O `npm ci` não concluiu dentro do limite do ambiente de execução, portanto o build completo (`npm run build`) ainda deve ser executado na máquina de desenvolvimento antes do push/publicação.
