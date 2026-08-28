import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenação",
  teacher: "Professor",
  student: "Aluno",
  finance: "Financeiro",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">
            Perfil não localizado
          </h1>
          <p className="mt-3 text-slate-600">
            Não foi possível carregar seu perfil. Procure o administrador.
          </p>
        </div>
      </main>
    );
  }

  if (profile.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ⏳
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Cadastro aguardando liberação
          </h1>
          <p className="mt-3 text-slate-600">
            Seu acesso foi registrado e precisa ser aprovado pelo administrador
            da Escola Conecta.
          </p>
        </div>
      </main>
    );
  }

  const firstName =
    profile.full_name?.split(" ")[0] || profile.email.split("@")[0];

  const cards = [
    { title: "Aulas", description: "Agenda, Google Meet e presença" },
    { title: "Materiais", description: "Arquivos e conteúdos das disciplinas" },
    { title: "Gravações", description: "Vídeos liberados para cada turma" },
    { title: "Calendário", description: "Aulas, atividades e prazos" },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Escola Conecta
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Olá, {firstName}
            </h1>
          </div>

          <div className="text-right">
            <p className="font-semibold text-slate-800">
              {roleLabels[profile.role] || profile.role}
            </p>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-blue-700 to-blue-500 p-8 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-100">
            Ambiente acadêmico
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            Tudo o que você precisa em um só lugar
          </h2>
          <p className="mt-3 max-w-2xl text-blue-100">
            Acompanhe aulas, materiais, gravações, presença e comunicações da
            instituição.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </article>
          ))}
        </div>

        {profile.role === "admin" && (
          <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Administração
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Painel administrativo disponível
            </h2>
            <p className="mt-2 text-slate-600">
              Aqui serão gerenciados usuários, cursos, turmas, conteúdos,
              permissões e auditoria.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}