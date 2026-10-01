import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import PendingSubmitButton from "@/components/pending-submit-button";

const statusNames: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  no_show: "Aluno ausente",
  teacher_no_show: "Professor ausente",
  cancelled: "Cancelada",
};

const statusClasses: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  no_show: "bg-amber-50 text-amber-800 border-amber-100",
  teacher_no_show: "bg-rose-50 text-rose-800 border-rose-100",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || profile.status !== "active") redirect("/dashboard");
  return supabase;
}

async function finishLesson(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const bookingId = String(formData.get("booking_id") || "");
  const status = String(formData.get("status") || "");
  const notes = String(formData.get("notes") || "");
  const { error } = await supabase.rpc("finish_escola_lesson", {
    p_booking_id: bookingId,
    p_status: status,
    p_notes: notes,
  });
  if (error) redirect(`/admin/aulas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/aulas");
  revalidatePath("/aulas/minhas");
  redirect("/admin/aulas?updated=1");
}

async function saveMeetingLink(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const bookingId = String(formData.get("booking_id") || "");
  const meetingUrl = String(formData.get("meeting_url") || "");
  const provider = String(formData.get("meeting_provider") || "Google Meet");
  const { error } = await supabase.rpc("set_lesson_meeting_link", {
    p_booking_id: bookingId,
    p_meeting_url: meetingUrl,
    p_provider: provider,
  });
  if (error) redirect(`/admin/aulas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/aulas");
  revalidatePath("/aulas/minhas");
  redirect("/admin/aulas?meeting=1");
}

function parseSaoPauloDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function rescheduleLesson(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const bookingId = String(formData.get("booking_id") || "");
  const parsed = parseSaoPauloDateTime(String(formData.get("new_date") || ""), String(formData.get("new_time") || ""));
  if (!parsed) redirect("/admin/aulas?error=Informe%20uma%20data%20e%20hor%C3%A1rio%20v%C3%A1lidos.");
  const { error } = await supabase.rpc("reschedule_escola_lesson_direct", {
    p_booking_id: bookingId,
    p_new_starts_at: parsed.toISOString(),
  });
  if (error) redirect(`/admin/aulas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/aulas");
  revalidatePath("/aulas/minhas");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect("/admin/aulas?rescheduled=1");
}

async function reviewRequest(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const requestId = String(formData.get("request_id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("review_note") || "");
  const { error } = await supabase.rpc("review_lesson_change_request", {
    p_request_id: requestId, p_decision: decision, p_review_note: note,
  });
  if (error) redirect(`/admin/aulas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/aulas"); revalidatePath("/aulas/minhas"); revalidatePath("/agenda"); revalidatePath("/dashboard");
  redirect("/admin/aulas?reviewed=1");
}

async function cancelLesson(formData: FormData) {
  "use server";
  const supabase = await ensureAdmin();
  const bookingId = String(formData.get("booking_id") || "");
  const reason = String(formData.get("cancel_reason") || "");
  const { error } = await supabase.rpc("cancel_escola_lesson", {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) redirect(`/admin/aulas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/aulas");
  revalidatePath("/aulas/minhas");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect("/admin/aulas?cancelled=1");
}

type Search = {
  from?: string;
  to?: string;
  teacher?: string;
  student?: string;
  status?: string;
  subject?: string;
  updated?: string;
  meeting?: string;
  rescheduled?: string;
  cancelled?: string;
  reviewed?: string;
  error?: string;
};

export default async function AdminAulas({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const supabase = await ensureAdmin();

  const { data: allBookings, error } = await supabase
    .from("lesson_bookings")
    .select("id,slot_id,student_id,student_name,student_phone,referral_source,subject,grade_level,teacher_id,starts_at,ends_at,status,outcome_notes,lesson_price,meeting_url,meeting_provider")
    .order("starts_at", { ascending: false })
    .limit(1000);

  const raw = allBookings || [];
  const teacherIds = [...new Set(raw.map((b) => b.teacher_id).filter(Boolean))];
  const { data: teachers } = teacherIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const teacherMap = Object.fromEntries((teachers || []).map((t) => [t.id, t.full_name || t.email]));
  const bookingIds = raw.map((b) => b.id);
  const { data: changeRequests } = bookingIds.length
    ? await supabase.from("lesson_change_requests").select("id,booking_id,request_type,requested_starts_at,reason,status,created_at").in("booking_id", bookingIds).eq("status", "pending").order("created_at", { ascending: false })
    : { data: [] as any[] };
  const pendingByBooking = new Map((changeRequests || []).map((r) => [r.booking_id, r]));

  const list = raw.filter((b) => {
    const starts = new Date(b.starts_at);
    if (params.from) {
      const from = new Date(`${params.from}T00:00:00-03:00`);
      if (starts < from) return false;
    }
    if (params.to) {
      const to = new Date(`${params.to}T23:59:59-03:00`);
      if (starts > to) return false;
    }
    if (params.teacher && b.teacher_id !== params.teacher) return false;
    if (params.status && b.status !== params.status) return false;
    if (params.student && !b.student_name.toLowerCase().includes(params.student.toLowerCase())) return false;
    if (params.subject && !`${b.subject} ${b.grade_level || ""}`.toLowerCase().includes(params.subject.toLowerCase())) return false;
    return true;
  });

  const counts = Object.keys(statusNames).reduce<Record<string, number>>((acc, key) => {
    acc[key] = raw.filter((b) => b.status === key).length;
    return acc;
  }, {});

  return (
    <div className="premium-page p-1 text-slate-900 md:p-3">
      <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-r from-[#12345e] via-[#1657ba] to-[#2f79ee] p-7 text-white shadow-[0_20px_55px_rgba(37,99,235,.14)] md:p-9">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-100">Escola Conecta • Administração</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Controle de aulas</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">Acompanhe agendamentos, resultados e links das aulas online em um único lugar.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-widest text-blue-100">Total registrado</p>
            <strong className="mt-1 block text-3xl">{raw.length}</strong>
          </div>
        </div>
      </section>

      <div className="my-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Object.entries(statusNames).map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}s</p>
            <div className="mt-2 flex items-end justify-between">
              <strong className="text-3xl font-extrabold text-[#173B73]">{counts[key] || 0}</strong>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[key]}`}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {(params.updated || params.meeting || params.rescheduled || params.cancelled || params.reviewed) && (
        <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {params.meeting ? "Link da aula online salvo com sucesso." : params.rescheduled ? "Aula remarcada com sucesso." : params.cancelled ? "Aula cancelada com sucesso." : params.reviewed ? "Solicitação do aluno analisada com sucesso." : "Situação da aula atualizada com sucesso."}
        </p>
      )}
      {params.error && <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-4 text-red-700">Não foi possível consultar as aulas.</p>}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-[#173B73]">Filtros</h2><p className="text-xs text-slate-500">Refine a lista sem alterar os dados registrados.</p></div>
          <a href="/admin/aulas" className="text-sm font-semibold text-blue-700">Limpar filtros</a>
        </div>
        <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-semibold text-slate-600">De<input type="date" name="from" defaultValue={params.from} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Até<input type="date" name="to" defaultValue={params.to} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Professor<select name="teacher" defaultValue={params.teacher || ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todos</option>{(teachers || []).map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Aluno<input name="student" defaultValue={params.student} placeholder="Nome do aluno" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Situação<select name="status" defaultValue={params.status || ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todas</option>{Object.entries(statusNames).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Disciplina<div className="mt-1 flex gap-2"><input name="subject" defaultValue={params.subject} placeholder="Disciplina" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button></div></label>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-bold text-[#173B73]">Aulas registradas</h2><p className="text-xs text-slate-500">{list.length} resultado(s) com os filtros atuais.</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Aluno","Professor","Disciplina","Data e horário","Situação","Aula online","Ações"].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((b) => {
                const canFinish = b.status === "scheduled" && new Date(b.starts_at) <= new Date();
                const pendingRequest = pendingByBooking.get(b.id);
                return <tr key={b.id} className="border-t border-slate-100 align-top hover:bg-blue-50/30">
                  <td className="px-4 py-4"><strong className="block text-slate-800">{b.student_name}</strong><span className="text-xs text-slate-500">{b.student_phone}</span></td>
                  <td className="px-4 py-4"><strong className="font-semibold text-slate-700">{teacherMap[b.teacher_id] || "Professor"}</strong></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{b.subject}</strong>{b.grade_level && <span className="text-xs text-slate-500">{b.grade_level}</span>}</td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{dateTime.format(new Date(b.starts_at))}</strong><span className="text-xs text-slate-500">até {dateTime.format(new Date(b.ends_at))}</span></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[b.status] || "bg-slate-50 text-slate-600"}`}>{statusNames[b.status] || b.status}</span></td>
                  <td className="px-4 py-4">{b.meeting_url ? <a href={b.meeting_url} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Abrir {b.meeting_provider || "aula online"} ↗</a> : <span className="text-xs text-slate-400">Não informado</span>}</td>
                  <td className="px-4 py-4">
                    <details className="group min-w-[235px]"><summary className="cursor-pointer list-none rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-bold text-blue-700 hover:bg-blue-50">Gerenciar aula</summary>
                      <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600"><p><strong>Origem:</strong> {b.referral_source}</p><p><strong>Valor:</strong> {Number(b.lesson_price || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</p>{b.outcome_notes && <p className="mt-1"><strong>Observações:</strong> {b.outcome_notes}</p>}</div>
                        <form action={saveMeetingLink} className="space-y-2 border-t border-slate-200 pt-3">
                          <input type="hidden" name="booking_id" value={b.id}/>
                          <label className="block text-xs font-semibold text-slate-600">Plataforma<input name="meeting_provider" defaultValue={b.meeting_provider || "Google Meet"} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/></label>
                          <label className="block text-xs font-semibold text-slate-600">Link da aula<input name="meeting_url" type="url" defaultValue={b.meeting_url || ""} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/></label>
                          <PendingSubmitButton pendingLabel="Salvando..." className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Salvar link online</PendingSubmitButton>
                        </form>
                        {pendingRequest && <div className="space-y-2 border-t border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-bold text-amber-900">Solicitação pendente do aluno</p>
                          <p className="text-xs text-amber-900">{pendingRequest.request_type === "reschedule" ? `Remarcação para ${dateTime.format(new Date(pendingRequest.requested_starts_at))}` : "Cancelamento da aula"}</p>
                          {pendingRequest.reason && <p className="text-xs text-amber-800">Motivo: {pendingRequest.reason}</p>}
                          <form action={reviewRequest} className="space-y-2"><input type="hidden" name="request_id" value={pendingRequest.id}/><input name="review_note" maxLength={500} placeholder="Observação da análise (opcional)" className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"/><div className="grid grid-cols-2 gap-2"><PendingSubmitButton name="decision" value="approved" pendingLabel="Aprovando..." className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Aprovar</PendingSubmitButton><PendingSubmitButton name="decision" value="rejected" pendingLabel="Registrando..." className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Não aprovar</PendingSubmitButton></div></form>
                        </div>}
                        {b.status === "scheduled" && !canFinish && <div className="space-y-3 border-t border-slate-200 pt-3">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Alterações da aula</p>
                          <p className="text-xs text-slate-500">Remarque diretamente por data e horário. Conteúdo, nível, duração e valor permanecem iguais.</p>
                          <form action={rescheduleLesson} className="space-y-2">
                            <input type="hidden" name="booking_id" value={b.id}/>
                            <div className="grid grid-cols-2 gap-2"><input type="date" name="new_date" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/><input type="time" name="new_time" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/></div>
                            <PendingSubmitButton pendingLabel="Remarcando..." className="w-full rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Remarcar aula</PendingSubmitButton>
                          </form>
                          <form action={cancelLesson} className="space-y-2">
                            <input type="hidden" name="booking_id" value={b.id}/>
                            <input name="cancel_reason" maxLength={500} placeholder="Motivo do cancelamento (opcional)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/>
                            <PendingSubmitButton pendingLabel="Cancelando..." className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Cancelar aula</PendingSubmitButton>
                          </form>
                        </div>}
                        {canFinish && <form action={finishLesson} className="space-y-2 border-t border-slate-200 pt-3"><input type="hidden" name="booking_id" value={b.id}/><textarea name="notes" maxLength={1000} placeholder="Observações opcionais" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/><div className="grid gap-2"><PendingSubmitButton name="status" value="completed" pendingLabel="Registrando..." className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Realizada</PendingSubmitButton><PendingSubmitButton name="status" value="no_show" pendingLabel="Registrando..." className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Aluno ausente</PendingSubmitButton><PendingSubmitButton name="status" value="teacher_no_show" pendingLabel="Registrando..." className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">Professor ausente</PendingSubmitButton></div></form>}
                      </div>
                    </details>
                  </td>
                </tr>;
              })}
              {!list.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhuma aula encontrada para os filtros informados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
