# Escola Conecta — continuidade 28/09/2026

## Alterações desta revisão

1. Agenda passa a reconhecer `availability_slots.status = 'reserved'` como **AGENDADO**.
2. Mantida compatibilidade visual com registros antigos `booked`, caso existam.
3. Filtro administrativo passa a usar `reserved` / **Agendado**.
4. Contador da agenda passa de **Reservados** para **Agendados**.
5. Criada central de notificações internas no sino.
6. Notificações de agendamento são criadas para aluno, professor e administradores ativos.
7. Sino mostra quantidade de não lidas, abre lista e permite marcar uma ou todas como lidas.
8. O bloco “Painel administrativo / Meu ambiente” agora leva para `/dashboard`.
9. A seta `⌄` sem função foi removida.

## Passo obrigatório no Supabase

Antes de testar as notificações internas, abra o **SQL Editor** do projeto Supabase e execute integralmente:

`supabase/migrations/20260928_internal_notifications_and_reserved_status.sql`

Esse script cria a tabela `notifications`, as políticas RLS, a função de geração dos alertas e atualiza `book_escola_lesson` para gravar o slot como `reserved`.

## Teste recomendado

1. Reinicie `npm.cmd run dev`.
2. Entre como aluno e reserve um horário disponível.
3. Confirme que o horário aparece como **AGENDADO** para professor/admin.
4. Entre como professor e abra o sino: deve haver “Nova aula agendada”.
5. Entre como administrador e confira o mesmo aviso.
6. Entre como aluno e confira “Aula agendada”.

As notificações externas por e-mail/WhatsApp continuam dependentes de credenciais e CRON e não fazem parte desta etapa.

## Ajuste adicional — botão Sair permanente
- Criado componente reutilizável `src/components/sign-out-button.tsx` usando a ação existente `signOut`.
- Adicionado **Sair** ao dashboard de todos os perfis.
- Adicionado **Sair** ao layout administrativo (vale para todas as páginas `/admin/*`).
- Mantido **Sair** na agenda usando o mesmo componente compartilhado.
- Adicionado **Sair** às páginas standalone `/aulas/minhas` e `/aulas/reservar`.
- Não houve alteração no Supabase para este ajuste.

## Painel do professor e navegação consistente
- Visão geral do professor agora consulta `lesson_bookings` e `availability_slots` reais.
- Exibe próxima aula, aulas dos próximos 7 dias, horários disponíveis, realizadas e ausências.
- Lista próximas aulas com aluno, disciplina e horário.
- Inclui atalhos funcionais para Calendário e Minhas aulas.
- Menu da Visão geral do administrador agora aponta para os módulos que já existem (`/admin/aulas`, presenças, cobranças, comunicações e configurações).
- Menu do professor e do aluno passa a exibir apenas rotas já funcionais.
- Na Agenda, professor e aluno também têm acesso direto a Minhas aulas; aluno também vê Reservar aula.
- Nenhuma migration SQL adicional é necessária para esta atualização.

## Ajuste de navegação persistente em Aulas
- Criado layout compartilhado para `/aulas/*` com menu lateral, cabeçalho, sino, identificação e botão Sair.
- `Minhas aulas` e `Reservar aula` agora permanecem dentro do mesmo ambiente visual do dashboard/agenda.
- Navegação por perfil usa o caminho atual para destacar a opção ativa.

## Professor gerencia o link da aula online
- Em `/aulas/minhas`, professores agora veem **Gerenciar aula online** nas aulas agendadas.
- O professor pode informar/alterar a plataforma (ex.: Google Meet) e o link da própria aula.
- A ação reutiliza `set_lesson_meeting_link`, que já restringe a alteração ao professor vinculado à aula ou administrador.
- Alunos continuam apenas visualizando o botão de acesso quando houver link.
