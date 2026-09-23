import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processLessonNotifications } from "@/lib/lesson-notifications";

type Props = { searchParams: Promise<{ reserved?: string; updated?: string; error?: string }> };
const displayDate = new Intl.DateTimeFormat("pt-BR", {dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"});
const names: Record<string,string> = { scheduled:"Agendada",completed:"Realizada",no_show:"Aluno ausente",cancelled:"Cancelada" };

async function finish(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = String(formData.get("booking_id") || "");
  const status = String(formData.get("status") || "");
  const notes = String(formData.get("notes") || "");
  const { error } = await supabase.rpc("finish_escola_lesson", {p_booking_id:id,p_status:status,p_notes:notes});
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/admin/aulas");
  try { await processLessonNotifications(6); } catch(e) { console.error("Notificações pendentes",e); }
  redirect("/aulas/minhas?updated=1");
}

export default async function MyLessons({searchParams}: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const {data:profile} = await supabase.from("profiles").select("role,status").eq("id",user.id).single();
  if (!profile || profile.status !== "active") redirect("/dashboard");
  const admin = profile.role === "admin";
  let query = supabase.from("lesson_bookings").select("id,student_id,teacher_id,student_name,student_phone,referral_source,subject,grade_level,starts_at,ends_at,status,outcome_notes").order("starts_at",{ascending:false}).limit(300);
  if (profile.role === "student") query = query.eq("student_id",user.id);
  else if (profile.role === "teacher") query = query.eq("teacher_id",user.id);
  else if (!admin) redirect("/dashboard");
  const {data:bookings,error} = await query;
  return <div className="mx-auto max-w-6xl p-6 text-slate-800">
    <header className="mb-7 rounded-3xl bg-gradient-to-r from-[#12345e] to-[#2563eb] p-7 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Escola Conecta</p>
      <h1 className="mt-2 text-3xl font-extrabold">{admin ? "Controle de aulas" : profile.role === "teacher" ? "Minhas aulas como professor" : "Minhas aulas"}</h1>
      <p className="mt-2 text-sm text-blue-100">Agendamentos e resultados registrados na plataforma.</p>
      <Link href="/agenda" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-900">Ver calendário</Link>
    </header>
    {(params.reserved || params.updated) && <p className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{params.reserved ? "Aula reservada! As notificações serão processadas pelos canais configurados." : "Resultado registrado com sucesso."}</p>}
    {params.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{params.error}</p>}
    {error && <p className="mb-4 text-red-700">Não foi possível consultar as aulas. Verifique se a migração foi aplicada.</p>}
    <div className="grid gap-4">{(bookings || []).map(b => <article key={b.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#173B73]">{b.subject} {b.grade_level ? `• ${b.grade_level}` : ""}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{names[b.status] || b.status}</span></div>
      <p className="mt-2 text-sm">{displayDate.format(new Date(b.starts_at))} — {displayDate.format(new Date(b.ends_at))}</p>
      <p className="mt-1 text-sm">Aluno: {b.student_name}</p>
      {profile.role !== "student" && <p className="mt-1 text-sm">Telefone: {b.student_phone} · Origem: {b.referral_source}</p>}
      {b.outcome_notes && <p className="mt-2 text-sm text-slate-600">Observações: {b.outcome_notes}</p>}
      {(admin || profile.role === "teacher") && b.status === "scheduled" && new Date(b.starts_at) <= new Date() &&
        <form action={finish} className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          <input type="hidden" name="booking_id" value={b.id}/>
          <input name="notes" maxLength={1000} placeholder="Observações opcionais" className="min-w-44 flex-1 rounded-lg border p-2 text-sm"/>
          <button name="status" value="completed" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Marcar realizada</button>
          <button name="status" value="no_show" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Aluno ausente</button>
        </form>}
    </article>)}
    {!bookings?.length && !error && <div className="rounded-xl bg-white p-8 text-center text-slate-500">Ainda não existem aulas registradas para este perfil.</div>}</div>
  </div>;
}
