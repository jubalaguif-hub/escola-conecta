# Escola Conecta — Premium Final

## O que foi alterado
- Visão Geral redesenhada com hero premium, indicadores e atalhos.
- Agenda recebeu o bloco visual com calendário/relógio em marca d'água e a frase “Educação que transforma realidades”.
- Usuários, Professores e Cursos mantêm a lógica original com Supabase; apenas o visual foi atualizado.
- A agenda mantém as operações existentes de disponibilidade no Supabase.
- Aulas, Presenças, Cobranças, Comunicações e Configurações são protótipos visuais e podem ser substituídos depois.

## O que NÃO foi alterado
- `.env.local`
- `src/lib/supabase/*`
- `src/app/actions/*`
- `src/app/auth/*`
- estrutura/tabelas/políticas do Supabase
- package.json/package-lock.json do projeto original

## Segurança dos protótipos
As páginas protótipo não devem executar insert/update/delete no Supabase. Elas existem para validar navegação e identidade visual até que as regras de negócio sejam definidas.
