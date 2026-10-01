import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewAvailabilityModal from "./components/NewAvailabilityModal";
import OfferingsEditor, { type Offering } from "../admin/professores/OfferingsEditor";

type PageProps = {
  searchParams: Promise<{
    week?: string;
    created?: string;
    removed?: string;
    error?: string;
    teacher?: string;
    subject?: string;
    grade?: string;
    status?: string;
  }>;
};

type Slot = {
  id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string;
  lesson_price: number | string;
  subject: string | null;
  grade_level: string | null;
  status: string;
  teacher:
    | {
        full_name?: string | null;
        email?: string | null;
        teaching_area?: string | null;
        teaching_subjects?: string[] | null;
        teaching_grade_levels?: string[] | null;
      }
    | {
        full_name?: string | null;
        email?: string | null;
        teaching_area?: string | null;
        teaching_subjects?: string[] | null;
        teaching_grade_levels?: string[] | null;
      }[]
    | null;
};

type LessonEvent = {
  id: string;
  booking_id: string;
  event_type: "rescheduled" | "cancelled" | "completed" | "no_show" | "teacher_no_show";
  subject: string;
  grade_level: string | null;
  student_name: string;
  original_starts_at: string | null;
  starts_at: string;
  ends_at: string;
  outcome_notes: string | null;
  created_at: string;
};

const TIME_ZONE = "America/Sao_Paulo";
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 24;
const SLOT_GRACE_MINUTES = 40;

function availabilityDeadline(slot: { starts_at: string; ends_at: string }) {
  const graceEnd = new Date(new Date(slot.starts_at).getTime() + SLOT_GRACE_MINUTES * 60_000);
  const lessonEnd = new Date(slot.ends_at);
  return graceEnd < lessonEnd ? graceEnd : lessonEnd;
}
const HOUR_HEIGHT = 64;
const CALENDAR_TOP_PADDING = 24;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const shortDayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: TIME_ZONE,
});

const dayNumberLabel = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  timeZone: TIME_ZONE,
});

const monthYearLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const fullDateLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: TIME_ZONE,
});

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
  }).format(date);
}

function startOfWeek(offset: number) {
  const today = new Date();
  const weekday = today.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offset * 7);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

function minutesInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function slotPosition(slot: Slot) {
  const start = minutesInSaoPaulo(new Date(slot.starts_at));
  const end = minutesInSaoPaulo(new Date(slot.ends_at));
  const dayStart = DAY_START_HOUR * 60;
  const topMinutes = Math.max(0, start - dayStart);
  const duration = Math.max(30, end >= start ? end - start : 30);

  return {
    top: `${CALENDAR_TOP_PADDING + (topMinutes / 60) * HOUR_HEIGHT}px`,
    height: `${Math.max(44, (duration / 60) * HOUR_HEIGHT)}px`,
  };
}

function weekTitle(days: Date[]) {
  const first = days[0];
  const last = days[6];
  const firstMonth = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TIME_ZONE }).format(first).replace(".", "");
  const lastMonth = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TIME_ZONE }).format(last).replace(".", "");
  const firstDay = dayNumberLabel.format(first);
  const lastDay = dayNumberLabel.format(last);

  if (firstMonth === lastMonth) return `${firstDay} – ${lastDay} de ${monthYearLabel.format(last)}`;
  return `${firstDay} de ${firstMonth} – ${lastDay} de ${lastMonth} de ${last.getFullYear()}`;
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, teaching_area, teaching_subjects, teaching_grade_levels, teaching_offerings, notification_phone")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/dashboard");

  return { supabase, user, profile };
}

async function saveMyOfferings(formData: FormData) {
  "use server";
  const { supabase, user, profile } = await getCurrentProfile();
  if (profile.role !== "teacher") redirect("/dashboard");
  let offerings: Offering[];
  try { offerings = JSON.parse(String(formData.get("offerings") || "[]")); }
  catch { redirect("/agenda?error=Dados%20invalidos"); }
  const validLevels = ["Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Superior"];
  if (!Array.isArray(offerings) || !offerings.length || offerings.length > 50 ||
      offerings.some(item => !validLevels.includes(item.grade_level) || typeof item.subject !== "string" || !item.subject.trim() || item.subject.length > 100)) {
    redirect("/agenda?error=Revise%20seus%20niveis%20e%20materias");
  }
  const clean = Array.from(new Map(offerings.map(item => {
    const record = { grade_level: item.grade_level, subject: item.subject.trim() };
    return [`${record.grade_level}::${record.subject.toLowerCase()}`, record] as const;
  })).values());
  const { error } = await supabase.from("profiles").update({
    teaching_offerings: clean,
    teaching_grade_levels: [...new Set(clean.map(item => item.grade_level))],
    teaching_subjects: [...new Set(clean.map(item => item.subject))]
  }).eq("id", user.id).eq("role", "teacher");
  if (error) redirect("/agenda?error=Nao%20foi%20possivel%20salvar");
  revalidatePath("/agenda");
  revalidatePath("/admin/professores");
  redirect("/agenda?updated=1");
}

async function saveTeacherPhone(formData: FormData) {
  "use server";
  const { supabase, user, profile } = await getCurrentProfile();
  if (profile.role !== "teacher") redirect("/dashboard");
  const phone = String(formData.get("notification_phone") || "").trim();
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 30)
    redirect("/agenda?error=Informe%20o%20WhatsApp%20com%20DDD");
  const { error } = await supabase.from("profiles").update({notification_phone:phone}).eq("id",user.id);
  if (error) redirect("/agenda?error=Nao%20foi%20possivel%20salvar%20WhatsApp");
  revalidatePath("/agenda");
  redirect("/agenda?updated=1");
}

async function createAvailability(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getCurrentProfile();
  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect("/agenda?error=Apenas%20professores%20ou%20administradores%20podem%20cadastrar%20hor%C3%A1rios.");
  }

  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("duration") || 0);
  const price = Number(formData.get("price") || 0);
  const subject = String(formData.get("subject") || "").trim();
  const gradeLevel = String(formData.get("grade_level") || "").trim();

  let targetTeacherId = user.id;
  let subjects: string[] = Array.isArray(profile.teaching_subjects) ? profile.teaching_subjects.filter(Boolean) : [];
  let offerings: { grade_level: string; subject: string }[] = Array.isArray(profile.teaching_offerings) ? profile.teaching_offerings : [];

  if (profile.role === "admin") {
    targetTeacherId = String(formData.get("teacher_id") || "");
    if (!targetTeacherId) {
      redirect("/agenda?error=Selecione%20um%20professor.");
    }

    const { data: targetTeacher } = await supabase
      .from("profiles")
      .select("id, role, status, teaching_subjects, teaching_offerings")
      .eq("id", targetTeacherId)
      .eq("role", "teacher")
      .eq("status", "active")
      .maybeSingle();

    if (!targetTeacher) {
      redirect("/agenda?error=Professor%20inv%C3%A1lido%20ou%20inativo.");
    }

    subjects = Array.isArray(targetTeacher.teaching_subjects) ? targetTeacher.teaching_subjects.filter(Boolean) : [];
    offerings = Array.isArray(targetTeacher.teaching_offerings) ? targetTeacher.teaching_offerings : [];
  }

  if (!date || !time || duration < 15 || price <= 0 || !subject) {
    redirect("/agenda?error=Preencha%20mat%C3%A9ria%2C%20data%2C%20hor%C3%A1rio%2C%20dura%C3%A7%C3%A3o%20e%20valor%20corretamente.");
  }

  if (!gradeLevel || !offerings.some((offering) => offering.grade_level === gradeLevel && offering.subject === subject)) {
    redirect("/agenda?error=Selecione%20uma%20combina%C3%A7%C3%A3o%20de%20n%C3%ADvel%20e%20mat%C3%A9ria%20cadastrada%20para%20o%20professor.");
  }

  if (!subjects.includes(subject)) {
    redirect("/agenda?error=Selecione%20uma%20mat%C3%A9ria%20cadastrada%20para%20o%20professor.");
  }

  const startsAt = new Date(`${date}T${time}:00-03:00`);
  const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    redirect("/agenda?error=Escolha%20um%20hor%C3%A1rio%20futuro.");
  }

  const { error } = await supabase.from("availability_slots").insert({
    teacher_id: targetTeacherId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    lesson_price: price,
    subject,
    grade_level: gradeLevel,
  });

  if (error) {
    redirect("/agenda?error=Este%20hor%C3%A1rio%20entra%20em%20conflito%20com%20outro%20j%C3%A1%20cadastrado.");
  }

  revalidatePath("/agenda");
  redirect("/agenda?created=1");
}

async function removeAvailability(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getCurrentProfile();
  if (profile.role !== "teacher" && profile.role !== "admin") redirect("/agenda");

  const slotId = String(formData.get("slot_id") || "");
  let deleteQuery = supabase
    .from("availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("status", "available");

  if (profile.role === "teacher") {
    deleteQuery = deleteQuery.eq("teacher_id", user.id);
  }

  const { error } = await deleteQuery;

  if (error) {
    redirect("/agenda?error=N%C3%A3o%20foi%20poss%C3%ADvel%20remover%20este%20hor%C3%A1rio.");
  }

  revalidatePath("/agenda");
  redirect("/agenda?removed=1");
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentProfile();
  const weekOffset = Number(params.week || 0) || 0;
  const monday = startOfWeek(weekOffset);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const weekEnd = new Date(days[6]);
  weekEnd.setDate(weekEnd.getDate() + 1);

  const isAdmin = profile.role === "admin";
  const isTeacher = profile.role === "teacher";
  const canManageAvailability = isTeacher || isAdmin;
  const isStudent = profile.role === "student";

  const selectedTeacherId = (isAdmin || isStudent) ? String(params.teacher || "") : "";
  const selectedSubject = (isAdmin || isStudent) ? String(params.subject || "") : "";
  const selectedGrade = (isAdmin || isStudent) ? String(params.grade || "") : "";
  const selectedStatus = isAdmin ? String(params.status || "") : "";

  let teacherProfiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    teaching_subjects: string[] | null;
    teaching_offerings: { grade_level: string; subject: string }[] | null;
  }[] = [];

  if (isAdmin || isStudent) {
    const { data: teachersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, teaching_subjects, teaching_offerings")
      .eq("role", "teacher")
      .eq("status", "active")
      .order("full_name");

    teacherProfiles = (teachersData || []) as typeof teacherProfiles;
  }

  const teachers = teacherProfiles.map((teacher) => ({
    id: teacher.id,
    label: teacher.full_name || teacher.email || "Professor",
    subjects: Array.isArray(teacher.teaching_subjects) ? teacher.teaching_subjects.filter(Boolean) : [],
    offerings: Array.isArray(teacher.teaching_offerings) ? teacher.teaching_offerings : [],
  }));

  const allTeacherSubjects = Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  let slotsQuery = supabase
    .from("availability_slots")
    .select(
      "id, teacher_id, starts_at, ends_at, lesson_price, subject, grade_level, status, teacher:profiles!availability_slots_teacher_id_fkey(full_name, email, teaching_area, teaching_subjects, teaching_grade_levels)"
    )
    .gte("starts_at", monday.toISOString())
    .lt("starts_at", weekEnd.toISOString())
    .order("starts_at");

  if (isTeacher) slotsQuery = slotsQuery.eq("teacher_id", profile.id);
  if ((isAdmin || isStudent) && selectedTeacherId) slotsQuery = slotsQuery.eq("teacher_id", selectedTeacherId);
  if ((isAdmin || isStudent) && selectedSubject) slotsQuery = slotsQuery.eq("subject", selectedSubject);
  if ((isAdmin || isStudent) && selectedGrade) slotsQuery = slotsQuery.eq("grade_level", selectedGrade);
  if (isStudent) {
    const graceFloor = new Date(Date.now() - SLOT_GRACE_MINUTES * 60_000).toISOString();
    slotsQuery = slotsQuery.eq("status", "available").gte("starts_at", graceFloor).gt("ends_at", new Date().toISOString());
  }
  if (isAdmin && selectedStatus) slotsQuery = slotsQuery.eq("status", selectedStatus);

  const { data } = await slotsQuery;
  const slots = (data || []) as Slot[];
  const now = new Date();
  const unfilledSlots = slots.filter((slot) => slot.status === "available" && availabilityDeadline(slot) < now);
  const activeSlots = slots.filter((slot) => {
    if (slot.status === "cancelled" || slot.status === "closed") return false;
    if (slot.status === "available" && availabilityDeadline(slot) < now) return false;
    return true;
  });

  let lessonHistory: LessonEvent[] = [];
  if (isTeacher || isAdmin) {
    let historyQuery = supabase
      .from("lesson_events")
      .select("id,booking_id,event_type,subject,grade_level,student_name,original_starts_at,starts_at,ends_at,outcome_notes,created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (isTeacher) historyQuery = historyQuery.eq("teacher_id", profile.id);
    if (isAdmin && selectedTeacherId) historyQuery = historyQuery.eq("teacher_id", selectedTeacherId);
    const { data: historyData } = await historyQuery;
    lessonHistory = (historyData || []) as LessonEvent[];
  }

  const todayKey = dateKey(now);

  const filterQuery = (isAdmin || isStudent)
    ? `${selectedTeacherId ? `&teacher=${encodeURIComponent(selectedTeacherId)}` : ""}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedGrade ? `&grade=${encodeURIComponent(selectedGrade)}` : ""}${selectedStatus ? `&status=${encodeURIComponent(selectedStatus)}` : ""}`
    : "";
  const reservedCount = activeSlots.filter((slot) => slot.status === "reserved" || slot.status === "booked").length;
  const allGrades = Array.from(new Set(teachers.flatMap((teacher) => teacher.offerings.map((entry) => entry.grade_level)))).filter(Boolean).sort();
  const statusLabel = (status: string) => status === "available" ? "Disponível" : (status === "reserved" || status === "booked") ? "Agendado" : "Indisponível";
  const weeklyTeacherCount = new Set(activeSlots.map((slot) => slot.teacher_id)).size;
  const availableCount = activeSlots.filter((slot) => slot.status === "available").length;
  const weeklyHours = activeSlots.reduce((total, slot) => {
    const duration = new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime();
    return total + Math.max(0, duration / 3600000);
  }, 0);

  return (
    <div className="min-w-0 premium-agenda-page">
      <section className="agenda-premium-hero">
        <div className="agenda-premium-copy">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">◷</span>
            Calendário
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Agenda de aulas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {isAdmin
              ? "Acompanhe a agenda dos professores, filtre por matéria e gerencie disponibilidades."
              : isTeacher
                ? "Organize sua disponibilidade e acompanhe sua semana em uma visão simples de horários."
                : isStudent
                ? "Consulte os horários disponíveis e encontre o melhor momento para sua aula."
                : "Acompanhe os horários disponíveis na plataforma."}
          </p>
          {isTeacher && (
            <details className="mb-4 rounded-2xl border border-blue-100 bg-white p-4 text-slate-900">
              <summary className="cursor-pointer text-sm font-bold text-blue-800">Editar meus níveis de ensino e matérias</summary>
              <OfferingsEditor teacherId={profile.id} initial={Array.isArray(profile.teaching_offerings) ? profile.teaching_offerings : []} action={saveMyOfferings} />
            </details>
          )}
          {isTeacher && <form action={saveTeacherPhone} className="mb-3 flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-white p-3">
            <label className="flex-1 text-xs font-semibold text-slate-700">Meu WhatsApp para avisos de aula (com DDD)
              <input name="notification_phone" type="tel" required defaultValue={profile.notification_phone || ""} placeholder="(31) 99999-9999" className="mt-1 block w-full rounded-lg border p-2 text-sm" />
            </label>
            <button className="self-end rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Salvar WhatsApp</button>
          </form>}
          {canManageAvailability && (
            <div className="agenda-premium-cta">
              <NewAvailabilityModal
                action={createAvailability}
                defaultDate={dateKey(new Date())}
                subjects={isTeacher && Array.isArray(profile.teaching_subjects) ? profile.teaching_subjects.filter(Boolean) : []}
                teachers={teachers}
                offerings={isTeacher && Array.isArray(profile.teaching_offerings) ? profile.teaching_offerings : []}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
        <div className="agenda-premium-art" aria-hidden="true">
          <div className="agenda-art-spark a1"/><div className="agenda-art-spark a2"/><div className="agenda-art-spark a3"/>
          <div className="agenda-art-calendar">
            <div className="agenda-art-hooks"><span/><span/></div>
            <div className="agenda-art-grid">{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</div>
          </div>
          <div className="agenda-art-clock"><span/></div>
          <div className="agenda-art-claim">Educação<br/>que transforma<br/><strong>realidades</strong><em/></div>
        </div>
      </section>

      {params.created === "1" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span>✓</span> Horário disponibilizado com sucesso.
        </div>
      )}
      {params.removed === "1" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <span>✓</span> Horário removido da agenda.
        </div>
      )}
      {params.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{params.error}</div>
      )}

      {(isAdmin || isStudent) && (
        <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="week" value={weekOffset} />
          <label className="block min-w-0 text-xs font-bold text-slate-600">Professor
            <select name="teacher" defaultValue={selectedTeacherId} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
              <option value="">Todos os professores</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.label}</option>)}
            </select>
          </label>
          <label className="block min-w-0 text-xs font-bold text-slate-600">Nível de ensino
            <select name="grade" defaultValue={selectedGrade} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
              <option value="">Todos os níveis</option>
              {allGrades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </label>
          <label className="block min-w-0 text-xs font-bold text-slate-600">Matéria
            <select name="subject" defaultValue={selectedSubject} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
              <option value="">Todas as matérias</option>
              {allTeacherSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>
          <div className="flex min-w-0 flex-col justify-end gap-2">
            {isAdmin && <label className="block text-xs font-bold text-slate-600">Situação
              <select name="status" defaultValue={selectedStatus} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                <option value="">Todas as situações</option>
                <option value="available">Disponível</option>
                <option value="reserved">Agendado</option>
              </select>
            </label>}
            <div className="flex gap-2"><button type="submit" className="flex-1 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Filtrar</button>
              <Link href="/agenda" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Limpar</Link></div>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-[#F7FAFF] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#102C5B] to-[#1E55B8] px-5 py-5 text-white sm:px-7">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">{isAdmin ? "Gestão de agendas" : isStudent ? "Encontre sua aula" : "Minha agenda"}</p>
            <h2 className="mt-1 text-xl font-extrabold capitalize">{weekTitle(days)}</h2>
            <p className="mt-1 text-xs text-blue-100">{activeSlots.length} {activeSlots.length === 1 ? "horário encontrado" : "horários encontrados"}</p>
          </div>
          <nav aria-label="Navegação entre semanas" className="flex items-center gap-2">
            <Link href={`/agenda?week=${weekOffset - 1}${filterQuery}`} aria-label="Semana anterior" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-bold hover:bg-white/20">←</Link>
            <Link href={`/agenda?week=0${filterQuery}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#173B73]">Hoje</Link>
            <Link href={`/agenda?week=${weekOffset + 1}${filterQuery}`} aria-label="Próxima semana" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-bold hover:bg-white/20">→</Link>
          </nav>
        </div>
        {(isTeacher || isAdmin) && <div className="grid gap-3 border-b border-blue-100 bg-white p-4 sm:grid-cols-3 sm:p-6">
          <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Disponíveis</p><p className="mt-1 text-3xl font-extrabold text-[#173B73]">{availableCount}</p></div>
          <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Agendados</p><p className="mt-1 text-3xl font-extrabold text-amber-900">{reservedCount}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-600">Total na semana</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{activeSlots.length}</p></div>
        </div>}
        <div className="space-y-5 p-4 sm:p-6">
          {activeSlots.length === 0 && <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-8 text-center text-sm text-slate-600">{isStudent ? "Não há horários disponíveis nesta semana com os filtros selecionados." : "Nenhum horário nesta semana com os filtros selecionados."}</div>}
          {days.map((day) => {
            const key = dateKey(day);
            const daySlots = activeSlots.filter((slot) => dateKey(new Date(slot.starts_at)) === key);
            if (!daySlots.length) return null;
            return <section key={key} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                <h3 className="text-base font-extrabold capitalize text-[#173B73]">{fullDateLabel.format(day)}</h3>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{daySlots.length} {daySlots.length === 1 ? "horário" : "horários"}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {daySlots.map((slot) => {
                  const teacher = Array.isArray(slot.teacher) ? slot.teacher[0] : slot.teacher;
                  const available = slot.status === "available";
                  const reserved = slot.status === "reserved" || slot.status === "booked";
                  const awaitingOutcome = reserved && new Date(slot.starts_at) <= now;
                  const duration = Math.max(0, (new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000);
                  return <article key={slot.id} className={`min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${available ? "border-blue-200" : reserved ? "border-amber-200" : "border-slate-200"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${available ? "bg-blue-100 text-blue-800" : reserved ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{awaitingOutcome ? "Aguardando registro" : statusLabel(slot.status)}</span>
                      <span className="text-xs font-semibold text-slate-500">{duration} min</span>
                    </div>
                    <p className="mt-4 text-2xl font-extrabold tracking-tight text-[#173B73]">{timeLabel.format(new Date(slot.starts_at))} – {timeLabel.format(new Date(slot.ends_at))}</p>
                    <p className="mt-2 text-sm font-bold text-blue-700">{[slot.grade_level, slot.subject].filter(Boolean).join(" · ") || "Aula particular"}</p>
                    {!isTeacher && <p className="mt-2 text-sm text-slate-600">Professor: <span className="font-semibold text-slate-900">{teacher?.full_name || teacher?.email || "Professor"}</span></p>}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <span className="text-lg font-extrabold text-[#173B73]">{currency.format(Number(slot.lesson_price))}</span>
                      {available && isStudent && <Link href={`/aulas/reservar?slot=${slot.id}`} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Reservar aula →</Link>}
                      {available && canManageAvailability && <form action={removeAvailability}>
                        <input type="hidden" name="slot_id" value={slot.id} />
                        <button type="submit" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700">Remover horário</button>
                      </form>}
                      {reserved && <Link href="/aulas/minhas" className="text-sm font-bold text-blue-700 hover:underline">Ver aulas →</Link>}
                    </div>
                  </article>;
                })}
              </div>
            </section>;
          })}
        </div>
      </section>

      {(isTeacher || isAdmin) && (
        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Histórico</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#173B73]">Aulas realizadas, canceladas e remarcadas</h2>
              <p className="mt-1 text-sm text-slate-500">Cancelamentos e remarcações liberam novamente o horário antigo enquanto ainda estiver dentro da janela de reserva. Depois do limite, horários livres aparecem como “Não reservado”.</p>
            </div>
            <Link href="/aulas/minhas" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">Ver histórico completo →</Link>
          </div>
          <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
            {unfilledSlots.map((slot) => (
              <article key={`unfilled-${slot.id}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-extrabold text-[#173B73]">{[slot.grade_level, slot.subject].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm text-slate-500">Horário oferecido na agenda</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold uppercase text-slate-700">Não reservado</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{fullDateLabel.format(new Date(slot.starts_at))} · {timeLabel.format(new Date(slot.starts_at))} – {timeLabel.format(new Date(slot.ends_at))}</p>
              </article>
            ))}
            {lessonHistory.map((event) => {
              const labels: Record<string, string> = { completed: "Realizada", cancelled: "Cancelada", rescheduled: "Remarcada", no_show: "Aluno ausente", teacher_no_show: "Professor ausente" };
              const classes: Record<string, string> = { completed: "bg-emerald-50 text-emerald-800", cancelled: "bg-rose-50 text-rose-800", rescheduled: "bg-indigo-50 text-indigo-800", no_show: "bg-amber-50 text-amber-800", teacher_no_show: "bg-orange-50 text-orange-800" };
              return <article key={event.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-extrabold text-[#173B73]">{[event.grade_level, event.subject].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm text-slate-500">Aluno: {event.student_name}</p></div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase ${classes[event.event_type] || "bg-slate-100 text-slate-700"}`}>{labels[event.event_type] || event.event_type}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{fullDateLabel.format(new Date(event.starts_at))} · {timeLabel.format(new Date(event.starts_at))} – {timeLabel.format(new Date(event.ends_at))}</p>
                {event.event_type === "rescheduled" && event.original_starts_at && <p className="mt-1 text-xs text-slate-500">Antes: {fullDateLabel.format(new Date(event.original_starts_at))} · {timeLabel.format(new Date(event.original_starts_at))}</p>}
                {event.outcome_notes && <p className="mt-2 text-xs text-slate-500">{event.outcome_notes}</p>}
              </article>;
            })}
            {!lessonHistory.length && !unfilledSlots.length && <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Ainda não há eventos no histórico. Os próximos resultados, cancelamentos, remarcações e horários não reservados serão registrados aqui.</div>}
          </div>
        </section>
      )}

      <div className="mt-4"><Link href="/aulas/minhas" className="inline-block rounded-xl bg-blue-800 px-5 py-3 text-sm font-bold text-white">Ver aulas agendadas e realizadas →</Link></div>
      <section className="premium-metric-grid mt-5">
        <article className="premium-metric"><div className="premium-metric-icon">▣</div><div><strong>{activeSlots.length}</strong><span>Horários na semana</span></div><small>Agenda atual</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">♙</div><div><strong>{weeklyTeacherCount}</strong><span>Professores envolvidos</span></div><small>Semana selecionada</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">✓</div><div><strong>{availableCount}</strong><span>Horários disponíveis</span></div><small>Prontos para reserva</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">◷</div><div><strong>{weeklyHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</strong><span>Total de horas</span></div><small>Carga da semana</small></article>
      </section>
    </div>
  );
}
