# Escola Conecta — landing premium e matérias por nível

## O que está pronto neste pacote
- Página inicial pública premium (/) usando a logo e fotos reais enviadas, mantendo /login original.
- Na agenda, professores podem editar as combinações nível + matéria; o administrador pode editar essas combinações na área Professores.
- Novo horário exige selecionar um nível e uma matéria cadastrados naquele nível; a validação ocorre novamente no servidor.
- O calendário exibe o nível e a matéria dos novos horários.

## Antes de executar o código novo
1. Faça um backup / commit da versão que está em produção na Vercel e de seu banco.
2. No Supabase da aplicação, abra SQL Editor e execute `supabase/migrations/20260922_teacher_offerings.sql` uma única vez. Migração aditiva: adiciona `profiles.teaching_offerings` e `availability_slots.grade_level`.
3. Preencha combinações de matérias e níveis de cada professor. O cadastro antigo de matérias continua no banco; porém os novos horários exigirão o cadastro combinado. Horários já existentes continuam com nível vazio.
4. Copie o seu `.env.local` da instalação anterior para a raiz deste projeto. O pacote NÃO contém chaves do Supabase.
5. Instale Node.js 20.9+ (de preferência LTS), abra esta pasta no VS Code e execute `npm ci`, depois `npm run dev`.
6. Acesse http://localhost:3000, entre via Google e teste com contas de professor e administrador. Verifique configuração de OAuth do Supabase para localhost antes de testar.
7. Só depois de confirmar, publique seu próprio repositório GitHub conectado à Vercel. Configure no painel Vercel as variáveis de ambiente já usadas no projeto.

## Limites desta entrega
O calendário existente foi ampliado; este pacote NÃO implementa do zero confirmação de aula, triagem, envio de e-mails/WhatsApp ou cobrança. Não foi executada migração em seu Supabase, nem feito deploy na Vercel. A garantia de não haver duas reservas simultâneas precisa ser validada pelas restrições e transações existentes do seu Supabase; esta atualização não afirma garanti-la.

## Diagnóstico local
- `npm run build`
- `npm run lint`

Se `npm ci` falhar por rede, confira conexão com registry.npmjs.org e proxy do computador.
