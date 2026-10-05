import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

type Props = { searchParams: Promise<{ month?: string; subject?: string }> };

type Booking = {
  id: string;
  student_name: string;
  subject: string;
  starts_at: string;
  status: string;
};

const attendanceStatuses = new Set(["completed", "no_show", "teacher_no_show"]);

function defaultMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function monthRange(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const safe = match ? value : defaultMonth();
  const [year, month] = safe.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    value: safe,
    start: `${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`,
  };
}

function statusLabel(status: string) {
  if (status === "completed") return "Aula realizada";
  if (status === "no_show") return "Aluno ausente";
  if (status === "teacher_no_show") return "Professor ausente";
  if (status === "scheduled") return "Agendada";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function attendanceLabel(status: string) {
  if (status === "completed" || status === "no_show") return "Presente";
  if (status === "teacher_no_show") return "Ausente";
  return "Não computada";
}

export default async function TeacherAttendancePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "teacher" || profile.status !== "active") redirect("/dashboard");

  const range = monthRange(params.month || defaultMonth());
  const selectedSubject = params.subject || "";

  let query = supabase
    .from("lesson_bookings")
    .select("id,student_name,subject,starts_at,status")
    .eq("teacher_id", user.id)
    .gte("starts_at", range.start)
    .lt("starts_at", range.end)
    .order("starts_at", { ascending: false });

  if (selectedSubject) query = query.eq("subject", selectedSubject);
  const { data: rows, error } = await query;
  const bookings = (rows || []) as Booking[];
  const subjects = [...new Set(bookings.map((booking) => booking.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const considered = bookings.filter((booking) => attendanceStatuses.has(booking.status));
  const present = considered.filter((booking) => booking.status === "completed" || booking.status === "no_show").length;
  const absent = considered.filter((booking) => booking.status === "teacher_no_show").length;
  const frequency = considered.length ? (present / considered.length) * 100 : 0;
  const scheduled = bookings.filter((booking) => booking.status === "scheduled").length;

  return (
    <PremiumPage
      eyebrow="Minha presença"
      title="Minha presença"
      description="Consulte sua frequência com base nos resultados das aulas registradas na plataforma."
      metrics={[
        { label: "Aulas registradas", value: String(considered.length), icon: "▣", hint: `${scheduled} agendada(s) no período` },
        { label: "Presenças", value: String(present), icon: "✓", hint: "Inclui aluno ausente" },
        { label: "Ausências", value: String(absent), icon: "!", hint: "Professor ausente" },
        { label: "Minha frequência", value: `${frequency.toFixed(1).replace(".", ",")}%`, icon: "%", hint: "No período filtrado" },
      ]}
    >
      <form method="get">
        <PremiumToolbar>
          <label>
            <span>Período</span>
            <input type="month" name="month" defaultValue={range.value} />
          </label>
          <label>
            <span>Matéria</span>
            <select name="subject" defaultValue={selectedSubject}>
              <option value="">Todas as matérias</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>
          <div />
          <button className="premium-filter-button" type="submit">⌕ Filtrar</button>
        </PremiumToolbar>
      </form>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Não foi possível carregar sua presença.</p>}

      <PremiumPanel title="Histórico de presença" subtitle="Se o aluno faltar, sua presença é mantida. Cancelamentos e aulas ainda agendadas não entram no percentual.">
        <div className="premium-table-wrap">
          <table className="premium-table">
            <thead><tr><th>Data</th><th>Aluno</th><th>Matéria</th><th>Resultado da aula</th><th>Minha presença</th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(booking.starts_at))}</td>
                  <td><strong>{booking.student_name}</strong></td>
                  <td>{booking.subject}</td>
                  <td>{statusLabel(booking.status)}</td>
                  <td>
                    <span className={`premium-status ${booking.status === "teacher_no_show" ? "premium-status-danger" : !attendanceStatuses.has(booking.status) ? "premium-status-warn" : ""}`}>
                      {attendanceLabel(booking.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && <tr><td colSpan={5}>Nenhuma aula encontrada no período selecionado.</td></tr>}
            </tbody>
          </table>
        </div>
      </PremiumPanel>
    </PremiumPage>
  );
}
