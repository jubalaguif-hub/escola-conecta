# ESCOLA CONECTA — entrega consolidada para avaliação (NÃO publicada)

Base: versão premium + agenda/matérias, com **todo o patch anterior de reservas, triagem, controle de aulas e notificações**, mais novo pedido de cadastro de professores por conta ativa com aprovação do administrador. Landing page aprovada preservada (não inclui a proposta alternativa de fundo matemático).

## Atenção: esta versão é de desenvolvimento
Não execute SQL diretamente no Supabase de produção nem envie à Vercel antes de comparar seu repositório, fazer backup, testar em ambiente separado e confirmar as políticas existentes. O código foi montado a partir dos ZIPs da conversa, não de um clone atualizado do GitHub. **Não substitua cegamente o repositório nem seus arquivos .env.**

### O que há
- `/professor/cadastro`: após autenticação Google, aluno ativo preenche nome, formação, experiência, descrição, WhatsApp, foto por URL HTTPS e disciplinas/níveis; pedido passa a pendente.
- `/admin/professores/solicitacoes`: admin ativo analisa e aprova/rejeita. RPC no banco verifica permissões e impede ativação pelo usuário.
- `supabase/migrations/20260924_teacher_approvals.sql`: colunas de perfil, funções de pedido/revisão e histórico de decisão; não modifica professores já existentes.
- Módulo anterior **incluído**: `20260923_booking_management.sql`, `/aulas/reservar`, `/aulas/minhas`, controle `/admin/aulas`, triagem, reserva transacional, fila de e-mail e WhatsApp; ver `COMO_INSTALAR_MODULO_AULAS.md`.
- Cadastro não é upload de foto: é URL HTTPS. E-mail/WhatsApp não enviam sem configurar provedores/credenciais, templates aprovados e agendador de reenvios.

### Sequência segura
1. Salve uma cópia do projeto `escola-conecta-github` e crie uma branch de testes; compare os arquivos desta entrega, não copie sobre alterações novas sem revisão.
2. `npm.cmd install` e `npm.cmd run build` na pasta com `package.json`.
3. Verifique esquema/policies reais do Supabase e rode migrações **em ambiente de teste**, em ordem `20260922` (se não aplicada), `20260923`, `20260924`.
4. Teste aluno, solicitação de professor, rejeição, aprovação, indisponibilidade de agenda para pendentes, reserva concorrente, finalização e notificações sem tokens.
5. Só publique após passar os testes e configurar segredos exclusivamente na Vercel. Não envie `.env.local` ou `SUPABASE_SERVICE_ROLE_KEY` ao GitHub.

### Limitações conhecidas
- Cadastro docente exige login Google como aluno ativo; pedido por quem ainda não tem perfil depende da criação de profiles existente.
- Administrador não recebe notificação externa da solicitação de professor nesta versão; vê a fila interna.
- Foto aceita URL pública HTTPS em vez de upload.
- E-mail e WhatsApp automáticos exigem credenciais reais e conformidade com consentimento/Meta.
- Cancelar/remarcar, pagamento e lembretes ainda não implementados.

- **Verificação de segurança obrigatória:** revise todas as policies RLS da tabela `profiles` no Supabase real: nenhum UPDATE direto do cliente pode permitir modificar `role`/`status` para contornar aprovação.
- A restrição `unique(slot_id)` impede duas reservas do MESMO slot, mas não garante ausência de sobreposição entre slots diferentes do professor. A agenda precisa ser revisada para horários sobrepostos.
