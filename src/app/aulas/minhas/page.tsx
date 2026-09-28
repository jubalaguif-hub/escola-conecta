import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processLessonNotifications } from "@/lib/lesson-notifications";

type Props = { searchParams: Promise<{ reserved?: string; updated?: string; meeting?: string; rescheduled?: string; cancelled?: string; requested?: string; reviewed?: string; error?: string }> };
const displayDate = new Intl.DateTimeFormat("pt-BR", {dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"});
const names: Record<string,string> = { scheduled:"Agendada",completed:"Realizada",no_show:"Aluno ausente",cancelled:"Cancelada" };

function parseSaoPauloDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

async function saveMeetingLink(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const bookingId = String(formData.get("booking_id") || "");
  const meetingUrl = String(formData.get("meeting_url") || "");
  const provider = String(formData.get("meeting_provider") || "Google Meet");
  const { error } = await supabase.rpc("set_lesson_meeting_link", {p_booking_id: bookingId,p_meeting_url: meetingUrl,p_provider: provider});
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/dashboard"); revalidatePath("/admin/aulas");
  redirect("/aulas/minhas?meeting=1");
}

async function rescheduleDirect(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const bookingId = String(formData.get("booking_id") || "");
  const date = String(formData.get("new_date") || "");
  const time = String(formData.get("new_time") || "");
  const startsAt = parseSaoPauloDateTime(date, time);
  if (!startsAt) redirect("/aulas/minhas?error=Informe%20uma%20data%20e%20hor%C3%A1rio%20v%C3%A1lidos.");
  const { error } = await supabase.rpc("reschedule_escola_lesson_direct", {p_booking_id: bookingId,p_new_starts_at: startsAt.toISOString()});
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/agenda"); revalidatePath("/dashboard"); revalidatePath("/admin/aulas");
  redirect("/aulas/minhas?rescheduled=1");
}

async function cancelLesson(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const bookingId = String(formData.get("booking_id") || "");
  const reason = String(formData.get("cancel_reason") || "");
  const { error } = await supabase.rpc("cancel_escola_lesson", {p_booking_id: bookingId,p_reason: reason});
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/agenda"); revalidatePath("/dashboard"); revalidatePath("/admin/aulas");
  redirect("/aulas/minhas?cancelled=1");
}

async function requestChange(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const bookingId = String(formData.get("booking_id") || "");
  const requestType = String(formData.get("request_type") || "");
  const reason = String(formData.get("reason") || "");
  let requestedStartsAt: string | null = null;
  if (requestType === "reschedule") {
    const parsed = parseSaoPauloDateTime(String(formData.get("new_date") || ""), String(formData.get("new_time") || ""));
    if (!parsed) redirect("/aulas/minhas?error=Informe%20a%20nova%20data%20e%20hor%C3%A1rio.");
    requestedStartsAt = parsed.toISOString();
  }
  const { error } = await supabase.rpc("request_lesson_change", {
    p_booking_id: bookingId,
    p_request_type: requestType,
    p_requested_starts_at: requestedStartsAt,
    p_reason: reason,
  });
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/admin/aulas");
  redirect("/aulas/minhas?requested=1");
}

async function reviewRequest(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const requestId = String(formData.get("request_id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("review_note") || "");
  const { error } = await supabase.rpc("review_lesson_change_request", {p_request_id: requestId,p_decision: decision,p_review_note: note});
  if (error) redirect(`/aulas/minhas?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/aulas/minhas"); revalidatePath("/admin/aulas"); revalidatePath("/agenda"); revalidatePath("/dashboard");
  redirect("/aulas/minhas?reviewed=1");
}

export default async function MyLessons({searchParams}: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const {data:profile} = await supabase.from("profiles").select("role,status").eq("id",user.id).single();
  if (!profile || profile.status !== "active") redirect("/dashboard");
  const admin = profile.role === "admin";
  let query = supabase.from("lesson_bookings").select("id,slot_id,student_id,teacher_id,student_name,student_phone,referral_source,subject,grade_level,starts_at,ends_at,status,outcome_notes,lesson_price,meeting_url,meeting_provider").order("starts_at",{ascending:false}).limit(300);
  if (profile.role === "student") query = query.eq("student_id",user.id);
  else if (profile.role === "teacher") query = query.eq("teacher_id",user.id);
  else if (!admin) redirect("/dashboard");
  const {data:bookings,error} = await query;
  const bookingIds = (bookings || []).map((b) => b.id);
  const { data: changeRequests } = bookingIds.length
    ? await supabase.from("lesson_change_requests").select("id,booking_id,requester_id,request_type,requested_starts_at,reason,status,review_note,created_at").in("booking_id", bookingIds).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const requestsByBooking = new Map<string, any[]>();
  for (const request of changeRequests || []) {
    const arr = requestsByBooking.get(request.booking_id) || [];
    arr.push(request); requestsByBooking.set(request.booking_id, arr);
  }

  return <div className="mx-auto max-w-6xl py-2 text-slate-800">
    <header className="mb-7 rounded-3xl bg-gradient-to-r from-[#12345e] to-[#2563eb] p-7 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Escola Conecta</p>
      <h1 className="mt-2 text-3xl font-extrabold">{admin ? "Controle de aulas" : profile.role === "teacher" ? "Minhas aulas como professor" : "Minhas aulas"}</h1>
      <p className="mt-2 text-sm text-blue-100">Agendamentos, alterações e resultados registrados na plataforma.</p>
      <Link href="/agenda" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-900">Ver calendário</Link>
    </header>

    {(params.reserved || params.updated || params.meeting || params.rescheduled || params.cancelled || params.requested || params.reviewed) && <p className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{params.reserved ? "Aula reservada com sucesso." : params.meeting ? "Link da aula online salvo com sucesso." : params.rescheduled ? "Aula remarcada com sucesso." : params.cancelled ? "Aula cancelada com sucesso." : params.requested ? "Solicitação enviada ao professor e à administração." : params.reviewed ? "Solicitação analisada com sucesso." : "Resultado registrado com sucesso."}</p>}
    {params.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{params.error}</p>}
    {error && <p className="mb-4 text-red-700">Não foi possível consultar as aulas.</p>}

    <div className="grid gap-4">{(bookings || []).map(b => {
      const canFinish = b.status === "scheduled" && new Date(b.starts_at) <= new Date();
      const futureScheduled = b.status === "scheduled" && new Date(b.starts_at) > new Date();
      const durationMinutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000);
      const requests = requestsByBooking.get(b.id) || [];
      const pendingRequest = requests.find((r) => r.status === "pending");
      return <article key={b.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#173B73]">{b.subject} {b.grade_level ? `• ${b.grade_level}` : ""}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{names[b.status] || b.status}</span></div>
        <p className="mt-2 text-sm">{displayDate.format(new Date(b.starts_at))} — {displayDate.format(new Date(b.ends_at))}</p>
        <p className="mt-1 text-sm">Aluno: {b.student_name}</p>
        {profile.role !== "student" && <p className="mt-1 text-sm">Telefone: {b.student_phone} · Origem: {b.referral_source}</p>}
        <p className="mt-1 text-xs text-slate-500">{durationMinutes} min · {Number(b.lesson_price || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</p>
        {b.outcome_notes && <p className="mt-2 text-sm text-slate-600">Observações: {b.outcome_notes}</p>}
        {b.meeting_url && b.status === "scheduled" && <a href={b.meeting_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Acessar {b.meeting_provider || "aula online"} ↗</a>}

        {profile.role === "student" && pendingRequest && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Solicitação pendente:</strong> {pendingRequest.request_type === "reschedule" ? `remarcação para ${displayDate.format(new Date(pendingRequest.requested_starts_at))}` : "cancelamento"}. Aguarde a análise do professor ou da administração.</div>}

        {futureScheduled && profile.role === "student" && !pendingRequest && <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-blue-800">Solicitar alteração da aula</summary>
          <p className="mt-2 text-xs text-slate-500">A matéria, o nível, a duração e o valor da aula serão mantidos.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <form action={requestChange} className="rounded-xl border border-slate-200 bg-white p-3">
              <input type="hidden" name="booking_id" value={b.id}/><input type="hidden" name="request_type" value="reschedule"/>
              <p className="text-sm font-bold text-slate-700">Solicitar remarcação</p>
              <div className="mt-2 grid grid-cols-2 gap-2"><input type="date" name="new_date" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/><input type="time" name="new_time" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div>
              <input name="reason" maxLength={500} placeholder="Motivo (opcional)" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
              <button className="mt-2 w-full rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white">Enviar solicitação</button>
            </form>
            <form action={requestChange} className="rounded-xl border border-slate-200 bg-white p-3">
              <input type="hidden" name="booking_id" value={b.id}/><input type="hidden" name="request_type" value="cancel"/>
              <p className="text-sm font-bold text-slate-700">Solicitar cancelamento</p>
              <textarea name="reason" maxLength={500} placeholder="Motivo (opcional)" className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
              <button className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">Enviar solicitação</button>
            </form>
          </div>
        </details>}

        {(admin || profile.role === "teacher") && b.status === "scheduled" && <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-blue-800">Gerenciar aula</summary>

          {pendingRequest && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">Solicitação do aluno</p>
            <p className="mt-1 text-sm text-amber-900">{pendingRequest.request_type === "reschedule" ? `Remarcar para ${displayDate.format(new Date(pendingRequest.requested_starts_at))}` : "Cancelar esta aula"}</p>
            {pendingRequest.reason && <p className="mt-1 text-xs text-amber-800">Motivo: {pendingRequest.reason}</p>}
            <form action={reviewRequest} className="mt-3"><input type="hidden" name="request_id" value={pendingRequest.id}/><input name="review_note" maxLength={500} placeholder="Observação da análise (opcional)" className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/><div className="mt-2 grid grid-cols-2 gap-2"><button name="decision" value="approved" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Aprovar</button><button name="decision" value="rejected" className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">Não aprovar</button></div></form>
          </div>}

          <div className="mt-4"><p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">Aula online</p>
            <form action={saveMeetingLink} className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end"><input type="hidden" name="booking_id" value={b.id}/><label className="text-xs font-semibold text-slate-600">Plataforma<input name="meeting_provider" defaultValue={b.meeting_provider || "Google Meet"} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/></label><label className="text-xs font-semibold text-slate-600">Link da aula<input name="meeting_url" type="url" defaultValue={b.meeting_url || ""} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/></label><button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Salvar link</button></form>
          </div>

          {futureScheduled && <div className="mt-5 border-t border-blue-100 pt-4"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Alterações da aula</p><p className="mt-1 text-xs text-slate-500">A remarcação mantém conteúdo, nível, duração e valor. Não é necessário criar disponibilidade antes.</p><div className="mt-3 grid gap-3 lg:grid-cols-2">
            <form action={rescheduleDirect} className="rounded-xl border border-slate-200 bg-white p-3"><input type="hidden" name="booking_id" value={b.id}/><p className="text-sm font-bold text-slate-700">Remarcar agora</p><div className="mt-2 grid grid-cols-2 gap-2"><input type="date" name="new_date" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/><input type="time" name="new_time" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><button className="mt-2 w-full rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white">Remarcar aula</button></form>
            <form action={cancelLesson} className="rounded-xl border border-slate-200 bg-white p-3"><input type="hidden" name="booking_id" value={b.id}/><p className="text-sm font-bold text-slate-700">Cancelar aula</p><input name="cancel_reason" maxLength={500} placeholder="Motivo do cancelamento (opcional)" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/><button className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">Cancelar aula</button></form>
          </div></div>}

          <div className="mt-5 border-t border-blue-100 pt-4"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Resultado da aula</p>{canFinish ? <form action={finish} className="mt-3"><input type="hidden" name="booking_id" value={b.id}/><textarea name="notes" maxLength={1000} placeholder="Observações opcionais" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/><div className="mt-2 grid grid-cols-2 gap-2"><button name="status" value="completed" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Compareceu / Aula realizada</button><button name="status" value="no_show" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white">Não compareceu / Ausência</button></div></form> : <p className="mt-2 text-sm text-slate-500">O registro de presença será liberado quando chegar o horário da aula.</p>}</div>
        </details>}
      </article>;
    })}</div>
  </div>;
}
