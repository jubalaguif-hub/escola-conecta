import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processLessonNotifications } from "@/lib/lesson-notifications";

type Props = { searchParams: Promise<{ slot?: string; error?: string }> };
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function reserve(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const slotId = String(formData.get("slot_id") || "");
  const name = String(formData.get("student_name") || "").trim();
  const phone = String(formData.get("student_phone") || "").trim();
  const referral = String(formData.get("referral_source") || "");
  const consent = formData.get("consent") === "on";
  const { data, error } = await supabase.rpc("book_escola_lesson", {
    p_slot_id: slotId, p_student_name: name, p_student_phone: phone,
    p_referral_source: referral, p_consent_notifications: consent,
  });
  if (error || !data) {
    redirect(`/aulas/reservar?slot=${encodeURIComponent(slotId)}&error=${encodeURIComponent(error?.message || "Não foi possível reservar")}`);
  }
  revalidatePath("/agenda");
  revalidatePath("/aulas/minhas");
  revalidatePath("/admin/aulas");
  // A reserva já foi gravada. Falhas de envio ficam na fila persistente para retentativa.
  try { await processLessonNotifications(6); } catch (error) { console.error("Notificações pendentes", error); }
  redirect("/aulas/minhas?reserved=1");
}

export default async function ReservePage({ searchParams }: Props) {
  const { slot: slotId, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/aulas/reservar?slot=${slotId || ""}`)}`);
  const { data: profile } = await supabase.from("profiles")
    .select("role,status,full_name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "student" || profile.status !== "active") redirect("/dashboard");
  if (!slotId) redirect("/agenda");
  const { data: slot } = await supabase.from("availability_slots")
    .select("id,teacher_id,subject,grade_level,starts_at,ends_at,status,lesson_price,teacher:profiles!availability_slots_teacher_id_fkey(full_name)")
    .eq("id", slotId).maybeSingle();
  if (!slot || slot.status !== "available" || new Date(slot.starts_at) <= new Date()) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Horário indisponível</h1><p className="my-4">Esta aula já foi reservada ou o prazo passou.</p><Link href="/agenda" className="text-blue-700 underline">Escolher outro horário</Link></main>;
  }
  const teacher = Array.isArray(slot.teacher) ? slot.teacher[0] : slot.teacher;
  return <main className="text-slate-800">
    <div className="mx-auto max-w-2xl rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/10 sm:p-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/agenda" className="text-sm font-semibold text-blue-700">← Voltar à agenda</Link>
      </div>
      <p className="mt-7 text-xs font-bold uppercase tracking-widest text-blue-600">Escola Conecta • Agendamento</p>
      <h1 className="mt-2 text-3xl font-extrabold text-[#173B73]">Confirme sua aula</h1>
      <div className="my-7 rounded-2xl bg-blue-50 p-5 text-sm leading-7">
        <p><b>Professor:</b> {teacher?.full_name || "Professor"}</p>
        <p><b>Disciplina:</b> {slot.subject || "Aula particular"}</p>
        <p><b>Nível:</b> {slot.grade_level || "Não informado"}</p>
        <p><b>Início:</b> {dateTime.format(new Date(slot.starts_at))}</p>
        <p><b>Fim:</b> {dateTime.format(new Date(slot.ends_at))}</p>
        <p><b>Valor informado:</b> {money.format(Number(slot.lesson_price))}</p>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <form action={reserve} className="grid gap-5">
        <input type="hidden" name="slot_id" value={slot.id}/>
        <label className="grid gap-2 text-sm font-semibold">Nome completo
          <input required name="student_name" minLength={3} maxLength={150} defaultValue={profile.full_name || ""} className="rounded-xl border border-slate-300 p-3"/>
        </label>
        <label className="grid gap-2 text-sm font-semibold">WhatsApp com DDD
          <input required name="student_phone" type="tel" minLength={8} maxLength={30} placeholder="(31) 99999-9999" className="rounded-xl border border-slate-300 p-3"/>
        </label>
        <label className="grid gap-2 text-sm font-semibold">Como conheceu nossa rede de ensino?
          <select required name="referral_source" defaultValue="" className="rounded-xl border border-slate-300 p-3">
            <option value="" disabled>Selecione</option>
            {["Indicação","Instagram","Google","Panfleto","Outros"].map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex gap-3 text-sm leading-6"><input required type="checkbox" name="consent" className="mt-1"/>
          Autorizo receber informações sobre meus agendamentos por e-mail e WhatsApp. Meu telefone será compartilhado com o professor responsável e a administração para organizar esta aula.
        </label>
        <button className="rounded-xl bg-[#2563eb] px-5 py-4 font-bold text-white hover:bg-[#173B73]">Confirmar agendamento</button>
        <p className="text-xs text-slate-500">A confirmação depende da disponibilidade no momento do envio. O horário não será reservado duas vezes.</p>
      </form>
    </div>
  </main>;
}
