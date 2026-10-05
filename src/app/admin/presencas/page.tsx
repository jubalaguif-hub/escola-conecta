import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

type Props = {
  searchParams: Promise<{ month?: string; teacher?: string; subject?: string }>;
};

type Booking = {
  id: string;
  teacher_id: string;
  student_name: string;
  subject: string;
  starts_at: string;
  status: string;
};

type Teacher = {
  id: string;
  full_name: string | null;
  email: string;
};

const attendanceStatuses = new Set(["completed", "no_show", "teacher_no_show"]);

function defaultMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
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

function teacherName(teacher: Teacher) {
  return teacher.full_name || teacher.email.split("@")[0];
}

function pct(present: number, absent: number) {
  const total = present + absent;
  return total ? (present / total) * 100 : 0;
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

export default async function AttendancePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.status !== "active") redirect("/dashboard");

  const range = monthRange(params.month || defaultMonth());
  const selectedTeacher = params.teacher || "";
  const selectedSubject = params.subject || "";

  const { data: teacherRows } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "teacher")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  const teachers = (teacherRows || []) as Teacher[];

  let bookingQuery = supabase
    .from("lesson_bookings")
    .select("id,teacher_id,student_name,subject,starts_at,status")
    .gte("starts_at", range.start)
    .lt("starts_at", range.end)
    .order("starts_at", { ascending: false });

  if (selectedTeacher) bookingQuery = bookingQuery.eq("teacher_id", selectedTeacher);
  if (selectedSubject) bookingQuery = bookingQuery.eq("subject", selectedSubject);

  const { data: bookingRows, error } = await bookingQuery;
  const bookings = (bookingRows || []) as Booking[];
  const considered = bookings.filter((booking) => attendanceStatuses.has(booking.status));
  const totalPresent = considered.filter((booking) => booking.status === "completed" || booking.status === "no_show").length;
  const totalAbsent = considered.filter((booking) => booking.status === "teacher_no_show").length;
  const totalFrequency = pct(totalPresent, totalAbsent);
  const subjects = [...new Set(bookings.map((booking) => booking.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const visibleTeachers = selectedTeacher
    ? teachers.filter((teacher) => teacher.id === selectedTeacher)
    : teachers;

  const summaries = visibleTeachers.map((teacher) => {
    const rows = bookings.filter((booking) => booking.teacher_id === teacher.id && attendanceStatuses.has(booking.status));
    const present = rows.filter((booking) => booking.status === "completed" || booking.status === "no_show").length;
    const absent = rows.filter((booking) => booking.status === "teacher_no_show").length;
    return { teacher, total: rows.length, present, absent, frequency: pct(present, absent) };
  });

  const detailTeacher = selectedTeacher ? teachers.find((teacher) => teacher.id === selectedTeacher) : null;

  return (
    <PremiumPage
      eyebrow="Presenças"
      title="Presença dos professores"
      description="Acompanhe a frequência dos professores usando os resultados reais das aulas registradas na plataforma."
      metrics={[
        { label: "Aulas consideradas", value: String(considered.length), icon: "▣", hint: "Realizadas e ausências" },
        { label: "Presenças", value: String(totalPresent), icon: "✓", hint: "Inclui aluno ausente" },
        { label: "Ausências", value: String(totalAbsent), icon: "!", hint: "Professor ausente" },
        { label: "Frequência geral", value: `${totalFrequency.toFixed(1).replace(".", ",")}%`, icon: "%", hint: "No período filtrado" },
      ]}
    >
      <form method="get">
        <PremiumToolbar>
          <label>
            <span>Período</span>
            <input type="month" name="month" defaultValue={range.value} />
          </label>
          <label>
            <span>Professor</span>
            <select name="teacher" defaultValue={selectedTeacher}>
              <option value="">Todos os professores</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
            </select>
          </label>
          <label>
            <span>Matéria</span>
            <select name="subject" defaultValue={selectedSubject}>
              <option value="">Todas as matérias</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>
          <button className="premium-filter-button" type="submit">⌕ Filtrar</button>
        </PremiumToolbar>
      </form>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Não foi possível carregar as presenças.</p>}

      <PremiumPanel title="Resumo por professor" subtitle="Realizada e aluno ausente contam como presença do professor. Professor ausente conta como falta.">
        <div className="premium-table-wrap">
          <table className="premium-table">
            <thead>
              <tr><th>Professor</th><th>Aulas</th><th>Presenças</th><th>Ausências</th><th>Frequência</th><th>Detalhes</th></tr>
            </thead>
            <tbody>
              {summaries.map(({ teacher, total, present, absent, frequency }) => (
                <tr key={teacher.id}>
                  <td><strong>{teacherName(teacher)}</strong><br/><span>{teacher.email}</span></td>
                  <td>{total}</td>
                  <td><span className="premium-status">{present}</span></td>
                  <td><span className={absent ? "premium-status premium-status-danger" : "premium-status"}>{absent}</span></td>
                  <td><strong>{frequency.toFixed(1).replace(".", ",")}%</strong></td>
                  <td>
                    <Link
                      className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                      href={`/admin/presencas?month=${encodeURIComponent(range.value)}&teacher=${teacher.id}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}`}
                    >
                      Ver aulas
                    </Link>
                  </td>
                </tr>
              ))}
              {summaries.length === 0 && <tr><td colSpan={6}>Nenhum professor ativo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </PremiumPanel>

      {detailTeacher && (
        <div className="mt-5">
          <PremiumPanel title={`Detalhamento — ${teacherName(detailTeacher)}`} subtitle="Histórico das aulas do professor no período selecionado.">
            <div className="premium-table-wrap">
              <table className="premium-table">
                <thead><tr><th>Data</th><th>Aluno</th><th>Matéria</th><th>Resultado</th><th>Presença</th></tr></thead>
                <tbody>
                  {bookings.filter((booking) => booking.teacher_id === detailTeacher.id).map((booking) => (
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
                  {bookings.filter((booking) => booking.teacher_id === detailTeacher.id).length === 0 && <tr><td colSpan={5}>Nenhuma aula encontrada para este professor no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </PremiumPanel>
        </div>
      )}
    </PremiumPage>
  );
}
