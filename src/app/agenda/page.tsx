import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    week?: string;
    created?: string;
    removed?: string;
    error?: string;
  }>;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
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

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/dashboard");

  return { supabase, user, profile };
}

async function createAvailability(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getCurrentProfile();
  if (profile.role !== "teacher" && profile.role !== "admin") redirect("/agenda?error=Apenas%20professores%20podem%20cadastrar%20hor%C3%A1rios.");

  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("duration") || 0);
  const price = Number(formData.get("price") || 0);

  if (!date || !time || duration < 15 || price <= 0) {
    redirect("/agenda?error=Preencha%20data%2C%20hor%C3%A1rio%2C%20dura%C3%A7%C3%A3o%20e%20valor%20corretamente.");
  }

  const startsAt = new Date(`${date}T${time}:00-03:00`);
  const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    redirect("/agenda?error=Escolha%20um%20hor%C3%A1rio%20futuro.");
  }

  const { error } = await supabase.from("availability_slots").insert({
    teacher_id: user.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    lesson_price: price,
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
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("teacher_id", user.id)
    .eq("status", "available");

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

  const isTeacher = profile.role === "teacher" || profile.role === "admin";
  const isStudent = profile.role === "student";

  let slotsQuery = supabase
    .from("availability_slots")
    .select(
      "id, teacher_id, starts_at, ends_at, lesson_price, status, teacher:profiles!availability_slots_teacher_id_fkey(full_name, email)"
    )
    .gte("starts_at", monday.toISOString())
    .lt("starts_at", weekEnd.toISOString())
    .order("starts_at");

  if (isTeacher) slotsQuery = slotsQuery.eq("teacher_id", profile.id);

  const { data } = await slotsQuery;
  const slots = data || [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-violet-600">
              ESCOLA CONECTA
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Agenda de aulas</h1>
            <p className="mt-2 text-sm text-slate-500">
              {isTeacher
                ? "Cadastre os horários que deseja disponibilizar aos alunos."
                : isStudent
                  ? "Escolha um horário disponível para sua aula particular."
                  : "Acompanhe os horários disponíveis na plataforma."}
            </p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm">
            Voltar ao painel
          </Link>
        </header>

        {params.created === "1" && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Horário disponibilizado com sucesso.</div>
        )}
        {params.removed === "1" && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">Horário removido da agenda.</div>
        )}
        {params.error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{params.error}</div>
        )}

        <div className={`grid gap-6 ${isTeacher ? "xl:grid-cols-[320px_1fr]" : ""}`}>
          {isTeacher && (
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Disponibilizar horário</h2>
              <p className="mt-1 text-sm text-slate-500">Cada horário terá duração e valor próprios.</p>
              <form action={createAvailability} className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">Data
                  <input name="date" type="date" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Horário de início
                  <input name="time" type="time" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Duração em minutos
                  <input name="duration" type="number" min="15" step="5" placeholder="Ex.: 60" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Valor total da aula
                  <input name="price" type="number" min="1" step="0.01" placeholder="Ex.: 100,00" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500" />
                </label>
                <div className="rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-800">O aluno pagará 30% como sinal de reserva. Os 70% restantes serão mostrados no agendamento.</div>
                <button type="submit" className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-700">Adicionar à agenda</button>
              </form>
            </aside>
          )}

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Calendário semanal</h2>
                <p className="mt-1 text-sm text-slate-500">Clique em um horário disponível para conferir os detalhes.</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/agenda?week=${weekOffset - 1}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">←</Link>
                <Link href="/agenda" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Hoje</Link>
                <Link href={`/agenda?week=${weekOffset + 1}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">→</Link>
              </div>
            </div>

            <div className="grid min-w-[760px] grid-cols-7 overflow-x-auto border-l border-t border-slate-200">
              {days.map((day) => {
                const key = dateKey(day);
                const daySlots = slots.filter((slot) => dateKey(new Date(slot.starts_at)) === key);
                return (
                  <div key={key} className="min-h-[360px] border-b border-r border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-center">
                      <p className="text-xs font-bold uppercase text-slate-500">{dateLabel.format(day)}</p>
                    </div>
                    <div className="space-y-2 p-2">
                      {daySlots.map((slot) => {
                        const teacher = Array.isArray(slot.teacher) ? slot.teacher[0] : slot.teacher;
                        const available = slot.status === "available";
                        return (
                          <article key={slot.id} className={`rounded-xl border p-3 text-left ${available ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-100"}`}>
                            <strong className="block text-sm">{timeLabel.format(new Date(slot.starts_at))} – {timeLabel.format(new Date(slot.ends_at))}</strong>
                            {!isTeacher && <span className="mt-1 block text-xs text-slate-600">{teacher?.full_name || teacher?.email || "Professor"}</span>}
                            <span className="mt-2 block text-sm font-bold text-slate-800">{currency.format(Number(slot.lesson_price))}</span>
                            {available ? (
                              isTeacher ? (
                                <form action={removeAvailability} className="mt-3"><input type="hidden" name="slot_id" value={slot.id} /><button type="submit" className="text-xs font-bold text-red-600">Remover horário</button></form>
                              ) : (
                                <span className="mt-3 block text-xs font-bold text-emerald-700">Disponível para reserva</span>
                              )
                            ) : <span className="mt-3 block text-xs font-bold text-slate-500">Indisponível</span>}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
