import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
  }>;
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  inactive: "Inativo",
};

const statusStyles: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-slate-200 text-slate-700",
};

async function createCourse(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "active");
  const workloadValue = String(formData.get("workload_hours") || "").trim();

  if (!title) {
    redirect("/admin/cursos?error=Informe%20o%20nome%20do%20curso.");
  }

  const workloadHours = workloadValue ? Number(workloadValue) : null;

  if (
    workloadHours !== null &&
    (!Number.isInteger(workloadHours) || workloadHours < 0)
  ) {
    redirect(
      "/admin/cursos?error=Informe%20uma%20carga%20horária%20válida."
    );
  }

  const { error } = await supabase.from("courses").insert({
    title,
    description: description || null,
    workload_hours: workloadHours,
    status,
    created_by: user.id,
  });

  if (error) {
    redirect(
      "/admin/cursos?error=Não%20foi%20possível%20cadastrar%20o%20curso."
    );
  }

  revalidatePath("/admin/cursos");
  redirect("/admin/cursos?created=1");
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, workload_hours, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Escola Conecta
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Administração de cursos
            </h1>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
          >
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[390px_1fr]">
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Novo cadastro
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">
            Criar curso
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cadastre primeiro o curso. Depois vincularemos as turmas, o
            professor, os alunos e as aulas.
          </p>

          <form action={createCourse} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Nome do curso
              </span>
              <input
                name="title"
                required
                placeholder="Ex.: Matemática – Ensino Médio"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Descrição
              </span>
              <textarea
                name="description"
                rows={4}
                placeholder="Objetivo, público-alvo ou informações importantes."
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Carga horária total
              </span>
              <div className="relative mt-2">
                <input
                  name="workload_hours"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ex.: 40"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 pr-14 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <span className="absolute right-4 top-3 text-sm text-slate-500">
                  horas
                </span>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Situação
              </span>
              <select
                name="status"
                defaultValue="active"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="active">Ativo</option>
                <option value="draft">Rascunho</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Cadastrar curso
            </button>
          </form>
        </aside>

        <section>
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Catálogo acadêmico
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Cursos cadastrados
            </h2>
            <p className="mt-2 text-slate-600">
              Os cursos são a base para a criação de turmas e aulas.
            </p>
          </div>

          {params.created === "1" && (
            <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Curso cadastrado com sucesso.
            </p>
          )}

          {params.error && (
            <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
              {params.error}
            </p>
          )}

          {!courses || courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
                📚
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">
                Nenhum curso cadastrado ainda
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Use o formulário ao lado para cadastrar o primeiro curso.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {courses.map((course) => (
                <article
                  key={course.id}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {course.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        statusStyles[course.status] || statusStyles.inactive
                      }`}
                    >
                      {statusLabels[course.status] || course.status}
                    </span>
                  </div>

                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">
                    {course.description || "Sem descrição cadastrada."}
                  </p>

                  <p className="mt-5 text-sm font-semibold text-slate-700">
                    {course.workload_hours
                      ? `${course.workload_hours} horas`
                      : "Carga horária não informada"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}