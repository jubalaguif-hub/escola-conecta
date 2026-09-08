import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewAvailabilityModal from "./components/NewAvailabilityModal";

type PageProps = {
  searchParams: Promise<{
    week?: string;
    created?: string;
    removed?: string;
    error?: string;
    teacher?: string;
    subject?: string;
  }>;
};

type Slot = {
  id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string;
  lesson_price: number | string;
  subject: string | null;
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

const TIME_ZONE = "America/Sao_Paulo";
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 24;
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
    .select("id, full_name, email, role, status, teaching_area, teaching_subjects, teaching_grade_levels")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/dashboard");

  return { supabase, user, profile };
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

  let targetTeacherId = user.id;
  let subjects: string[] = Array.isArray(profile.teaching_subjects) ? profile.teaching_subjects.filter(Boolean) : [];

  if (profile.role === "admin") {
    targetTeacherId = String(formData.get("teacher_id") || "");
    if (!targetTeacherId) {
      redirect("/agenda?error=Selecione%20um%20professor.");
    }

    const { data: targetTeacher } = await supabase
      .from("profiles")
      .select("id, role, status, teaching_subjects")
      .eq("id", targetTeacherId)
      .eq("role", "teacher")
      .eq("status", "active")
      .maybeSingle();

    if (!targetTeacher) {
      redirect("/agenda?error=Professor%20inv%C3%A1lido%20ou%20inativo.");
    }

    subjects = Array.isArray(targetTeacher.teaching_subjects) ? targetTeacher.teaching_subjects.filter(Boolean) : [];
  }

  if (!date || !time || duration < 15 || price <= 0 || !subject) {
    redirect("/agenda?error=Preencha%20mat%C3%A9ria%2C%20data%2C%20hor%C3%A1rio%2C%20dura%C3%A7%C3%A3o%20e%20valor%20corretamente.");
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

  const selectedTeacherId = isAdmin ? String(params.teacher || "") : "";
  const selectedSubject = isAdmin ? String(params.subject || "") : "";

  let teacherProfiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    teaching_subjects: string[] | null;
  }[] = [];

  if (isAdmin) {
    const { data: teachersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, teaching_subjects")
      .eq("role", "teacher")
      .eq("status", "active")
      .order("full_name");

    teacherProfiles = (teachersData || []) as typeof teacherProfiles;
  }

  const teachers = teacherProfiles.map((teacher) => ({
    id: teacher.id,
    label: teacher.full_name || teacher.email || "Professor",
    subjects: Array.isArray(teacher.teaching_subjects) ? teacher.teaching_subjects.filter(Boolean) : [],
  }));

  const allTeacherSubjects = Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  let slotsQuery = supabase
    .from("availability_slots")
    .select(
      "id, teacher_id, starts_at, ends_at, lesson_price, subject, status, teacher:profiles!availability_slots_teacher_id_fkey(full_name, email, teaching_area, teaching_subjects, teaching_grade_levels)"
    )
    .gte("starts_at", monday.toISOString())
    .lt("starts_at", weekEnd.toISOString())
    .order("starts_at");

  if (isTeacher) slotsQuery = slotsQuery.eq("teacher_id", profile.id);
  if (isAdmin && selectedTeacherId) slotsQuery = slotsQuery.eq("teacher_id", selectedTeacherId);
  if (isAdmin && selectedSubject) slotsQuery = slotsQuery.eq("subject", selectedSubject);

  const { data } = await slotsQuery;
  const slots = (data || []) as Slot[];
  const todayKey = dateKey(new Date());
  const visibleHours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
  const adminFilterQuery = isAdmin
    ? `${selectedTeacherId ? `&teacher=${encodeURIComponent(selectedTeacherId)}` : ""}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}`
    : "";
  const weeklyTeacherCount = new Set(slots.map((slot) => slot.teacher_id)).size;
  const availableCount = slots.filter((slot) => slot.status === "available").length;
  const weeklyHours = slots.reduce((total, slot) => {
    const duration = new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime();
    return total + Math.max(0, duration / 3600000);
  }, 0);

  return (
    <div className="min-w-0">
      <div className="premium-page-head mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
        </div>
        {canManageAvailability && (
          <NewAvailabilityModal
            action={createAvailability}
            defaultDate={dateKey(new Date())}
            subjects={isTeacher && Array.isArray(profile.teaching_subjects) ? profile.teaching_subjects.filter(Boolean) : []}
            teachers={teachers}
            isAdmin={isAdmin}
          />
        )}
      </div>

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

      {isAdmin && (
        <form method="get" className="premium-toolbar mb-4 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="week" value={weekOffset} />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Professor</span>
            <select
              name="teacher"
              defaultValue={selectedTeacherId}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Todos os professores</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Matéria</span>
            <select
              name="subject"
              defaultValue={selectedSubject}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Todas as matérias</option>
              {allTeacherSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="premium-filter-button flex-1">Filtrar</button>
            {(selectedTeacherId || selectedSubject) && (
              <Link href={`/agenda?week=${weekOffset}`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Limpar</Link>
            )}
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 border-b border-blue-800/70 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-900 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Visão semanal</p>
            <h2 className="text-base font-extrabold capitalize text-white">{weekTitle(days)}</h2>
            <p className="mt-1 text-xs text-blue-100/80">{slots.length} {slots.length === 1 ? "horário nesta semana" : "horários nesta semana"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/agenda?week=${weekOffset - 1}${adminFilterQuery}`}
              aria-label="Semana anterior"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              ←
            </Link>
            <Link
              href={isAdmin && adminFilterQuery ? `/agenda?week=0${adminFilterQuery}` : "/agenda"}
              className="rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-bold text-blue-950 shadow-sm transition hover:bg-blue-50"
            >
              Hoje
            </Link>
            <Link
              href={`/agenda?week=${weekOffset + 1}${adminFilterQuery}`}
              aria-label="Próxima semana"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              →
            </Link>
          </div>
        </div>

        {/* Desktop: calendário temporal */}
        <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-blue-100 bg-gradient-to-b from-blue-50/80 to-white">
              <div className="border-r border-blue-100 bg-blue-50/40" />
              {days.map((day, index) => {
                const key = dateKey(day);
                const isToday = key === todayKey;
                const weekend = index > 4;
                return (
                  <div key={key} className={`border-r border-blue-100 px-2 py-3 text-center last:border-r-0 ${weekend ? "bg-slate-50/70" : ""}`}>
                    <p className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${isToday ? "text-blue-700" : weekend ? "text-slate-500" : "text-blue-600/80"}`}>
                      {shortDayLabel.format(day).replace(".", "")}
                    </p>
                    <div className={`mx-auto mt-1 grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${isToday ? "bg-blue-600 text-white shadow-sm ring-4 ring-blue-100" : "text-slate-900"}`}>
                      {dayNumberLabel.format(day)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))]">
              <div className="relative border-r border-slate-100" style={{ height: `${CALENDAR_TOP_PADDING + visibleHours.length * HOUR_HEIGHT}px` }}>
                {visibleHours.map((hour) => (
                  <div key={hour} className="absolute right-3 text-[11px] font-medium text-slate-400" style={{ top: `${CALENDAR_TOP_PADDING + (hour - DAY_START_HOUR) * HOUR_HEIGHT - 7}px` }}>
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((day, index) => {
                const key = dateKey(day);
                const daySlots = slots.filter((slot) => dateKey(new Date(slot.starts_at)) === key);
                const isToday = key === todayKey;
                const weekend = index > 4;

                return (
                  <div
                    key={key}
                    className={`relative border-r border-slate-100 last:border-r-0 ${isToday ? "bg-blue-50/30" : weekend ? "bg-slate-50/45" : "bg-white"}`}
                    style={{ height: `${CALENDAR_TOP_PADDING + visibleHours.length * HOUR_HEIGHT}px` }}
                  >
                    {visibleHours.map((hour) => (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-t border-slate-100"
                        style={{ top: `${CALENDAR_TOP_PADDING + (hour - DAY_START_HOUR) * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {daySlots.map((slot) => {
                      const teacher = Array.isArray(slot.teacher) ? slot.teacher[0] : slot.teacher;
                      const available = slot.status === "available";
                      const position = slotPosition(slot);

                      return (
                        <article
                          key={slot.id}
                          className={`absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-lg border px-2.5 py-2 shadow-sm transition hover:z-20 hover:shadow-md ${
                            available ? "border-blue-200 bg-blue-50 text-blue-950" : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                          style={position}
                        >
                          <p className="truncate text-[11px] font-extrabold">
                            {timeLabel.format(new Date(slot.starts_at))} – {timeLabel.format(new Date(slot.ends_at))}
                          </p>
                          {slot.subject && (
                            <p className="mt-0.5 truncate text-[10px] font-extrabold text-blue-700">{slot.subject}</p>
                          )}
                          {!isTeacher && (
                            <p className="mt-0.5 truncate text-[10px] font-semibold opacity-80">{teacher?.full_name || teacher?.email || "Professor"}</p>
                          )}
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span className="truncate text-[10px] font-bold">{currency.format(Number(slot.lesson_price))}</span>
                            {available && canManageAvailability && (
                              <form action={removeAvailability}>
                                <input type="hidden" name="slot_id" value={slot.id} />
                                <button
                                  type="submit"
                                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
                                  title="Remover horário"
                                >
                                  Remover
                                </button>
                              </form>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: agenda em lista, sem espremer sete colunas */}
        <div className="divide-y divide-slate-100 md:hidden">
          {days.map((day) => {
            const key = dateKey(day);
            const daySlots = slots.filter((slot) => dateKey(new Date(slot.starts_at)) === key);
            const isToday = key === todayKey;

            return (
              <div key={key} className={isToday ? "bg-blue-50/30" : "bg-white"}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-[0.08em] ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                      {isToday ? "Hoje" : shortDayLabel.format(day).replace(".", "")}
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold capitalize text-slate-800">{fullDateLabel.format(day)}</p>
                  </div>
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${isToday ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {dayNumberLabel.format(day)}
                  </span>
                </div>

                <div className="px-4 pb-4">
                  {daySlots.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-xs font-medium text-slate-400">Nenhum horário disponível</p>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => {
                        const teacher = Array.isArray(slot.teacher) ? slot.teacher[0] : slot.teacher;
                        const available = slot.status === "available";
                        return (
                          <article key={slot.id} className={`rounded-xl border p-3 ${available ? "border-blue-100 bg-blue-50/70" : "border-slate-200 bg-slate-50"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold text-slate-900">
                                  {timeLabel.format(new Date(slot.starts_at))} – {timeLabel.format(new Date(slot.ends_at))}
                                </p>
                                {slot.subject && <p className="mt-1 text-xs font-extrabold text-blue-700">{slot.subject}</p>}
                                {!isTeacher && <p className="mt-1 truncate text-xs font-semibold text-slate-600">{teacher?.full_name || teacher?.email || "Professor"}</p>}
                                <p className="mt-1 text-xs font-bold text-blue-700">{currency.format(Number(slot.lesson_price))}</p>
                              </div>
                              {available && canManageAvailability && (
                                <form action={removeAvailability}>
                                  <input type="hidden" name="slot_id" value={slot.id} />
                                  <button type="submit" className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50">Remover</button>
                                </form>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="premium-metric-grid mt-5">
        <article className="premium-metric"><div className="premium-metric-icon">▣</div><div><strong>{slots.length}</strong><span>Horários na semana</span></div><small>Agenda atual</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">♙</div><div><strong>{weeklyTeacherCount}</strong><span>Professores envolvidos</span></div><small>Semana selecionada</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">✓</div><div><strong>{availableCount}</strong><span>Horários disponíveis</span></div><small>Prontos para reserva</small></article>
        <article className="premium-metric"><div className="premium-metric-icon">◷</div><div><strong>{weeklyHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</strong><span>Total de horas</span></div><small>Carga da semana</small></article>
      </section>
    </div>
  );
}
