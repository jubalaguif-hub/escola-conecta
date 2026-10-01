import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Offering } from "@/app/admin/professores/OfferingsEditor";
import TeachingEditor from "./TeachingEditor";
import { createClient } from "@/lib/supabase/server";

const VALID_LEVELS = ["Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Superior"];

async function getTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,status,teaching_area,teaching_subjects,teaching_grade_levels,teaching_offerings")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher" || profile.status !== "active") redirect("/dashboard");
  return { supabase, user, profile };
}

async function saveMyTeaching(formData: FormData) {
  "use server";
  const { supabase, user } = await getTeacher();
  const teachingArea = String(formData.get("teaching_area") || "").trim();
  let offerings: Offering[];

  try {
    offerings = JSON.parse(String(formData.get("offerings") || "[]"));
  } catch {
    redirect("/professor/ensino?error=Dados%20invalidos");
  }

  if (teachingArea.length > 120 || !Array.isArray(offerings) || offerings.length === 0 || offerings.length > 50 ||
      offerings.some((item) => !VALID_LEVELS.includes(item.grade_level) || typeof item.subject !== "string" || !item.subject.trim() || item.subject.length > 100)) {
    redirect("/professor/ensino?error=Revise%20a%20area%2C%20os%20niveis%20e%20as%20materias");
  }

  const clean = Array.from(new Map(offerings.map((item) => {
    const record = { grade_level: item.grade_level, subject: item.subject.trim() };
    return [`${record.grade_level}::${record.subject.toLowerCase()}`, record] as const;
  })).values());

  const { error } = await supabase.rpc("update_my_teaching_offerings", {
    p_teaching_area: teachingArea,
    p_offerings: clean,
    p_grade_levels: [...new Set(clean.map((item) => item.grade_level))],
    p_subjects: [...new Set(clean.map((item) => item.subject))],
  });

  if (error) redirect("/professor/ensino?error=Nao%20foi%20possivel%20salvar");

  revalidatePath("/professor/ensino");
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/admin/professores");
  redirect("/professor/ensino?updated=1");
}

export default async function MeuEnsinoPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const { profile } = await getTeacher();
  const params = await searchParams;
  const offerings = Array.isArray(profile.teaching_offerings) ? profile.teaching_offerings as Offering[] : [];
  const subjects = Array.isArray(profile.teaching_subjects) ? profile.teaching_subjects : [];
  const gradeLevels = Array.isArray(profile.teaching_grade_levels) ? profile.teaching_grade_levels : [];

  return (
    <div className="premium-page premium-functional-page">
      <section className="premium-page-head">
        <p className="ec-eyebrow">PERFIL PEDAGÓGICO</p>
        <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-900">Meu ensino</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Mantenha atualizados sua área de ensino, os níveis e as matérias que você oferece aos alunos.
        </p>
      </section>

      {params.updated && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Perfil de ensino atualizado com sucesso.</div>}
      {params.error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{decodeURIComponent(params.error)}</div>}

      <section className="premium-hero-strip premium-functional-hero">
        <div>
          <span>SEU PERFIL DE ENSINO</span>
          <strong>Defina o que você ensina para aparecer corretamente na agenda e nas reservas.</strong>
        </div>
        <div className="premium-hero-orb">✦</div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Área de ensino</span>
          <strong className="mt-3 block text-lg text-slate-900">{profile.teaching_area || "Não informada"}</strong>
        </article>
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Níveis atendidos</span>
          <strong className="mt-3 block text-lg text-slate-900">{gradeLevels.length ? gradeLevels.join(", ") : "Não informados"}</strong>
        </article>
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Matérias cadastradas</span>
          <strong className="mt-3 block text-3xl text-slate-900">{subjects.length}</strong>
        </article>
      </section>

      <section className="ec-panel max-w-5xl">
        <div className="border-b border-slate-100 pb-5">
          <h2 className="text-xl font-bold text-slate-900">Informações pedagógicas</h2>
          <p className="mt-1 text-sm text-slate-500">As alterações serão usadas na agenda, na criação de disponibilidade e no cadastro das aulas.</p>
        </div>

        <TeachingEditor initialArea={profile.teaching_area || ""} initialOfferings={offerings} action={saveMyTeaching} />
      </section>
    </div>
  );
}
