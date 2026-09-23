# Escola Conecta — módulo de reservas e controle de aulas

**Atenção:** esta é uma versão de desenvolvimento baseada no ZIP anterior enviado na conversa, NÃO uma cópia atualizada do GitHub. Não foi possível rodar o build nesta sessão (instalação de dependências não concluiu). **Não publique diretamente em produção** sem validar o build, a migração, permissões e os testes de ponta a ponta.

## O que entrou no código
- Aluno autenticado e ativo escolhe SOMENTE um horário que o professor disponibilizou em `/agenda`.
- Triagem obrigatória: nome, telefone com DDD, origem e consentimento de mensagens.
- RPC transacional `book_escola_lesson` bloqueia o horário no Supabase, registra a aula e cria seis tarefas de notificação (e-mail/WhatsApp para aluno, professor e administrador).
- Professor registra realização ou ausência após o início da aula em `/aulas/minhas`.
- Administração acompanha indicadores de aulas **reais** em `/admin/aulas`; dados de exemplo da tela anterior foram removidos.
- Professor pode cadastrar WhatsApp de notificação na `/agenda`.
- Novo aluno com perfil `student/pending` passa a `active` no callback do login Google. Professores e usuários bloqueados não são liberados.
- A landing page, a logomarca e as fotos NÃO foram modificadas.

## Integração segura com seu GitHub
1. Faça backup ou crie uma branch no VS Code. Abra **escola-conecta-github** (a pasta clonada, com `.git`).
2. Extraia este ZIP para outra pasta. Copie apenas os caminhos novos/modificados listados neste pacote para o repositório. **Não copie a pasta inteira por cima sem comparar** se houve novos commits desde o ZIP original.
3. Rode `git diff`, `npm.cmd install`, `npm.cmd run build`, `npm.cmd run dev`.
4. Teste fluxo de aluno, professor e administrador em ambiente de teste; jamais suba credenciais para o Git.
5. Antes de publicar, confira/execute o SQL da migração `supabase/migrations/20260923_booking_management.sql` no projeto CORRETO após backup. O SQL pressupõe que `availability_slots.id` é UUID, que existe `status='available'` e que a coluna aceita `booked`; confirme no seu esquema. Se status estiver restrito a outros valores, adapte-o antes. Não execute duas vezes sem revisão de dados e permissões.
6. Só então faça `git add`, `git commit`, `git push origin main` e confira deploy na Vercel.

## Variáveis de ambiente (somente servidor; Vercel Project > Settings > Environment Variables)
```
SUPABASE_SERVICE_ROLE_KEY=...               # NUNCA NEXT_PUBLIC
RESEND_API_KEY=...                           # serviço de envio de e-mail
NOTIFICATION_FROM_EMAIL=Escola Conecta <avisos@seudominio.com>
ADMIN_NOTIFICATION_EMAIL=...                 # e-mail que receberá todas as aulas
ADMIN_NOTIFICATION_PHONE=5531999999999      # número com país+DDD
WHATSAPP_ACCESS_TOKEN=...                    # token oficial Meta
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TEMPLATE_NAME=escola_conecta_aula   # template APROVADO, idioma pt_BR, 4 variáveis
WHATSAPP_GRAPH_VERSION=v23.0                 # ajuste para versão Meta suportada
CRON_SECRET=...                              # valor longo aleatório
```
O template Meta precisa ter **exatamente quatro parâmetros de texto, nesta ordem**: evento, nome do aluno, disciplina, data/hora. Configure domínio/remetente verificado no serviço de e-mail. WhatsApp só funciona após configuração e aprovação do template. Consentimento/privacidade devem ser revisados para a operação real, especialmente com alunos menores de idade.

## Processamento/retentativas das notificações
Após reservar/finalizar, o servidor tenta processar parte da fila. Configure um agendador seguro (cron externo ou Vercel conforme seu plano) para acessar `GET https://SEU_SITE/api/notifications/process` com header `Authorization: Bearer <CRON_SECRET>`. **Sem agendador, tarefas não entregues não serão repetidas automaticamente.** Observe `lesson_notification_deliveries` no Supabase: `pending`, `processing`, `sent`, `failed`, `error_message`. Não confunda aula agendada com notificação enviada.

## Limites desta versão
- Pagamento, cancelamento, remarcação e envio de lembretes ainda NÃO implementados.
- Não há confirmação de entrega/leitura de WhatsApp, somente aceite pela API; e-mails também não garantem leitura.
- Não foi possível comparar com o esquema completo e políticas RLS do Supabase real; valide migração antes de produção.
- A fila protege o registro do agendamento mesmo que e-mail/WhatsApp falhem, mas requer credenciais e monitoramento.
- Caso a validação local falhe, não publique. Envie o erro do terminal para ajuste.
