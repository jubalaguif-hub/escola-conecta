import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deactivated?: string;
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

async function getAdmin() {
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

  return { supabase, user };
}

async function createCourse(formData: FormData) {
  "use server";

  const { supabase, user } = await getAdmin();

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

  if (!["draft", "active", "inactive"].includes(status)) {
    redirect("/admin/cursos?error=Situação%20do%20curso%20inválida.");
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
  revalidatePath("/dashboard");
  redirect("/admin/cursos?created=1");
}

async function updateCourse(formData: FormData) {
  "use server";

  const { supabase } = await getAdmin();

  const courseId = String(formData.get("course_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "active");
  const workloadValue = String(formData.get("workload_hours") || "").trim();

  if (!courseId || !title) {
    redirect(
      "/admin/cursos?error=Não%20foi%20possível%20identificar%20o%20curso."
    );
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

  if (!["draft", "active", "inactive"].includes(status)) {
    redirect("/admin/cursos?error=Situação%20do%20curso%20inválida.");
  }

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      description: description || null,
      workload_hours: workloadHours,
      status,
    })
    .eq("id", courseId);

  if (error) {
    redirect(
      "/admin/cursos?error=Não%20foi%20possível%20atualizar%20o%20curso."
    );
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/dashboard");
  redirect("/admin/cursos?updated=1");
}

async function deactivateCourse(formData: FormData) {
  "use server";

  const { supabase } = await getAdmin();
  const courseId = String(formData.get("course_id") || "").trim();

  if (!courseId) {
    redirect(
      "/admin/cursos?error=Não%20foi%20possível%20identificar%20o%20curso."
    );
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: "inactive" })
    .eq("id", courseId);

  if (error) {
    redirect(
      "/admin/cursos?error=Não%20foi%20possível%20desativar%20o%20curso."
    );
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/dashboard");
  redirect("/admin/cursos?deactivated=1");
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase } = await getAdmin();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, workload_hours, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <section className="mb-7">
        <p className="ec-eyebrow">CATÁLOGO ACADÊMICO</p>

        <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-900">
          Gerenciar cursos
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Cadastre e organize os cursos que serão utilizados na criação de
          turmas, aulas e matrículas.
        </p>
      </section>

      {params.created === "1" && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Curso cadastrado com sucesso.
        </p>
      )}

      {params.updated === "1" && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Curso atualizado com sucesso.
        </p>
      )}

      {params.deactivated === "1" && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Curso desativado com sucesso.
        </p>
      )}

      {params.error && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {params.error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="ec-panel">
          <div className="mb-6 flex items-center gap-3">
            <div className="ec-quick-icon ec-quick-purple">＋</div>

            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-widest text-violet-600">
                Novo cadastro
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Criar curso
              </h2>
            </div>
          </div>

          <form action={createCourse} className="space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Nome do curso
              </span>

              <input
                name="title"
                required
                placeholder="Ex.: Matemática – Ensino Médio"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
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
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 pr-14 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                <option value="active">Ativo</option>
                <option value="draft">Rascunho</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700"
            >
              Cadastrar curso
            </button>
          </form>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="m-0 text-xl font-bold text-slate-900">
                Cursos cadastrados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {courses?.length || 0}{" "}
                {(courses?.length || 0) === 1
                  ? "curso encontrado"
                  : "cursos encontrados"}
              </p>
            </div>
          </div>

          {!courses || courses.length === 0 ? (
            <div className="ec-panel text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-2xl text-violet-600">
                📚
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                Nenhum curso cadastrado
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Utilize o formulário ao lado para cadastrar o primeiro curso.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {courses.map((course) => (
                <article key={course.id} className="ec-panel">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 font-bold text-violet-600">
                          C
                        </div>

                        <div>
                          <h3 className="m-0 text-lg font-bold text-slate-900">
                            {course.title}
                          </h3>

                          <p className="mt-1 text-sm font-medium text-slate-500">
                            {course.workload_hours !== null
                              ? `${course.workload_hours} horas`
                              : "Carga horária não informada"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {course.description || "Sem descrição cadastrada."}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        statusStyles[course.status] || statusStyles.inactive
                      }`}
                    >
                      {statusLabels[course.status] || course.status}
                    </span>
                  </div>

                  <details className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                    <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-semibold text-violet-700">
                      Editar curso
                    </summary>

                    <form
                      action={updateCourse}
                      className="space-y-4 border-t border-slate-200 p-4"
                    >
                      <input
                        type="hidden"
                        name="course_id"
                        value={course.id}
                      />

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Nome do curso
                        </span>

                        <input
                          name="title"
                          required
                          defaultValue={course.title}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Descrição
                        </span>

                        <textarea
                          name="description"
                          rows={3}
                          defaultValue={course.description || ""}
                          className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">
                            Carga horária
                          </span>

                          <input
                            name="workload_hours"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={course.workload_hours ?? ""}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">
                            Situação
                          </span>

                          <select
                            name="status"
                            defaultValue={course.status}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                          >
                            <option value="active">Ativo</option>
                            <option value="draft">Rascunho</option>
                            <option value="inactive">Inativo</option>
                          </select>
                        </label>
                      </div>

                      <button
                        type="submit"
                        className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700"
                      >
                        Salvar alterações
                      </button>
                    </form>
                  </details>

                  {course.status !== "inactive" && (
                    <form action={deactivateCourse} className="mt-4">
                      <input
                        type="hidden"
                        name="course_id"
                        value={course.id}
                      />

                      <button
                        type="submit"
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Desativar curso
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}