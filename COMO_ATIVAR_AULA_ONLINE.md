# Aula online (Google Meet ou outro provedor)

1. No Supabase > SQL Editor, execute a migration:
   `supabase/migrations/20260928_lesson_meeting_links.sql`
2. Reinicie o projeto.
3. No admin, abra **Aulas > Gerenciar aula**.
4. Informe o provedor (ex.: Google Meet) e o link HTTPS.
5. O link passa a aparecer para o aluno e para o professor em **Minhas aulas** enquanto a aula estiver agendada.

O sistema não cria automaticamente uma reunião no Google Meet nesta etapa; ele armazena e disponibiliza com segurança o link da reunião vinculada à aula. A criação automática via Google Calendar/Meet pode ser adicionada depois, com OAuth e integração do Google Calendar.
