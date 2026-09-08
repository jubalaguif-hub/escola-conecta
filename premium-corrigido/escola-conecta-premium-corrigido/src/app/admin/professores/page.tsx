import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  pending: "Aguardando liberação",
  active: "Ativo",
  blocked: "Bloqueado",
  inactive: "Inativo",
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-800",
  inactive: "bg-slate-200 text-slate-700",
};

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  return supabase;
}

function initialsFrom(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function TeachersPage() {
  const supabase = await getAdmin();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, status, teaching_area, teaching_subjects, teaching_grade_levels, created_at")
    .eq("role", "teacher")
    .order("full_name", { ascending: true });

  const teachers = profiles || [];
  const activeCount = teachers.filter((teacher) => teacher.status === "active").length;
  const subjectCount = new Set(
    teachers.flatMap((teacher) => Array.isArray(teacher.teaching_subjects) ? teacher.teaching_subjects : [])
  ).size;
  const completeCount = teachers.filter(
    (teacher) => Array.isArray(teacher.teaching_subjects) && teacher.teaching_subjects.length > 0
  ).length;

  return (
    <div className="premium-page premium-functional-page">
      <section className="premium-page-head">
        <p className="ec-eyebrow">EQUIPE PEDAGÓGICA</p>
        <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-900">Professores</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Consulte quem está lecionando, as matérias cadastradas e os níveis atendidos por cada professor.
        </p>
      </section>

      <section className="premium-hero-strip premium-functional-hero">
        <div>
          <span>EXPERIÊNCIA ADMINISTRATIVA</span>
          <strong>Informações organizadas com visual mais moderno e elegante.</strong>
        </div>
        <div className="premium-hero-orb">♙</div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Professores</span>
          <strong className="mt-3 block text-3xl text-slate-900">{teachers.length}</strong>
        </article>
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Ativos</span>
          <strong className="mt-3 block text-3xl text-slate-900">{activeCount}</strong>
        </article>
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Matérias cadastradas</span>
          <strong className="mt-3 block text-3xl text-slate-900">{subjectCount}</strong>
          <small className="mt-1 block text-xs text-slate-400">{completeCount} perfis com matéria definida</small>
        </article>
      </section>

      {teachers.length === 0 ? (
        <div className="ec-panel text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-2xl">🎓</div>
          <h2 className="mt-5 text-lg font-bold text-slate-900">Nenhum professor cadastrado</h2>
          <p className="mt-2 text-sm text-slate-500">Transforme um usuário em Professor no painel de Usuários para que ele apareça aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {teachers.map((teacher) => {
            const displayName = teacher.full_name || teacher.email.split("@")[0];
            const subjects = Array.isArray(teacher.teaching_subjects) ? teacher.teaching_subjects : [];
            const gradeLevels = Array.isArray(teacher.teaching_grade_levels) ? teacher.teaching_grade_levels : [];

            return (
              <article key={teacher.id} className="ec-panel overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="ec-avatar h-12 w-12 shrink-0 text-sm">{initialsFrom(displayName)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-slate-900">{displayName}</h2>
                        <p className="mt-1 truncate text-sm text-slate-500">{teacher.email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[teacher.status] || statusStyles.inactive}`}>
                        {statusLabels[teacher.status] || teacher.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Área de ensino</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{teacher.teaching_area || "Não informada"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Níveis atendidos</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{gradeLevels.length ? gradeLevels.join(", ") : "Não informados"}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Matérias</p>
                  {subjects.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {subjects.map((subject) => (
                        <span key={subject} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                          {subject}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Professor ainda sem matérias cadastradas.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
