import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";
import PixPaymentButton from "./PixPaymentButton";

type Props = { searchParams: Promise<{ month?: string; payment?: string }> };
type Booking = {
  id: string;
  teacher_id: string;
  subject: string;
  starts_at: string;
  status: string;
  lesson_price: number | string;
  payment_status: "pending" | "paid";
  paid_at: string | null;
  payment_method: string | null;
};
type Teacher = { id: string; full_name: string | null; email: string };

function defaultMonth() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find(x => x.type === "year")?.value}-${p.find(x => x.type === "month")?.value}`;
}
function monthRange(value: string) {
  const safe = /^(\d{4})-(\d{2})$/.test(value) ? value : defaultMonth();
  const [y,m] = safe.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { value: safe, start: `${y}-${String(m).padStart(2,"0")}-01T00:00:00-03:00`, end: `${ny}-${String(nm).padStart(2,"0")}-01T00:00:00-03:00` };
}
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
function teacherName(t?: Teacher) { return t?.full_name || t?.email?.split("@")[0] || "Professor"; }
function isChargeable(status: string) { return status !== "cancelled" && status !== "teacher_no_show"; }
function lessonStatus(status: string) {
  if (status === "scheduled") return "Agendada";
  if (status === "completed") return "Realizada";
  if (status === "no_show") return "Aluno ausente";
  if (status === "teacher_no_show") return "Professor ausente";
  if (status === "cancelled") return "Cancelada";
  return status;
}
function paymentMethod(method: string | null) {
  if (method === "pix") return "PIX";
  if (method === "cash") return "Dinheiro";
  if (method === "card") return "Cartão";
  if (method === "transfer") return "Transferência";
  if (method === "other") return "Outro";
  return "—";
}

export default async function StudentPaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "student" || profile.status !== "active") redirect("/dashboard");

  const range = monthRange(params.month || defaultMonth());
  const selectedPayment = params.payment || "";
  let query = supabase.from("lesson_bookings")
    .select("id,teacher_id,subject,starts_at,status,lesson_price,payment_status,paid_at,payment_method")
    .eq("student_id", user.id)
    .gte("starts_at", range.start)
    .lt("starts_at", range.end)
    .order("starts_at", { ascending: false });
  if (selectedPayment) query = query.eq("payment_status", selectedPayment);
  const { data, error } = await query;
  const rows = (data || []) as Booking[];

  const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
  const { data: teacherRows } = teacherIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", teacherIds)
    : { data: [] as Teacher[] };
  const teacherMap = new Map(((teacherRows || []) as Teacher[]).map(t => [t.id, t]));

  const chargeable = rows.filter(r => isChargeable(r.status));
  const paidRows = chargeable.filter(r => r.payment_status === "paid");
  const pendingRows = chargeable.filter(r => r.payment_status === "pending");
  const paid = paidRows.reduce((s,r) => s + Number(r.lesson_price || 0), 0);
  const pending = pendingRows.reduce((s,r) => s + Number(r.lesson_price || 0), 0);
  const total = paid + pending;
  const nextPending = [...pendingRows].sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const pixKey = process.env.PAYMENT_PIX_KEY || process.env.NEXT_PUBLIC_PAYMENT_PIX_KEY || "";
  const pixReceiver = process.env.PAYMENT_PIX_RECEIVER || process.env.NEXT_PUBLIC_PAYMENT_PIX_RECEIVER || "";

  return (
    <PremiumPage eyebrow="Pagamentos" title="Minhas cobranças" description="Acompanhe os valores das suas aulas e realize pagamentos por PIX." metrics={[
      { label: "A pagar", value: money.format(pending), icon: "R$", hint: `${pendingRows.length} pagamento(s) pendente(s)` },
      { label: "Pago no mês", value: money.format(paid), icon: "✓", hint: `${paidRows.length} pagamento(s) confirmado(s)` },
      { label: "Total do mês", value: money.format(total), icon: "Σ", hint: `${chargeable.length} aula(s) cobrada(s)` },
      { label: "Próxima cobrança", value: nextPending ? dateOnly.format(new Date(nextPending.starts_at)) : "—", icon: "↗", hint: nextPending ? money.format(Number(nextPending.lesson_price || 0)) : "Nenhuma pendência" },
    ]}>
      <form method="get"><PremiumToolbar>
        <label><span>Competência</span><input type="month" name="month" defaultValue={range.value}/></label>
        <label><span>Pagamento</span><select name="payment" defaultValue={selectedPayment}><option value="">Todos</option><option value="pending">Pendente</option><option value="paid">Pago</option></select></label>
        <button className="premium-filter-button" type="submit">⌕ Filtrar</button>
      </PremiumToolbar></form>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Não foi possível carregar seus pagamentos. Confirme se a atualização financeira foi executada no Supabase.</p>}

      <PremiumPanel title="Aulas e pagamentos" subtitle="Aulas canceladas ou com ausência do professor permanecem no histórico, mas não são cobradas.">
        <div className="premium-table-wrap"><table className="premium-table"><thead><tr><th>Data</th><th>Professor</th><th>Aula</th><th>Valor</th><th>Situação</th><th>Pagamento</th><th>Forma</th><th>Ação</th></tr></thead><tbody>
          {rows.map(b => {
            const charge = isChargeable(b.status);
            const teacher = teacherName(teacherMap.get(b.teacher_id));
            const paidStatus = b.payment_status === "paid";
            return <tr key={b.id}>
              <td>{dateTime.format(new Date(b.starts_at))}</td>
              <td><strong>{teacher}</strong></td>
              <td>{b.subject}</td>
              <td><strong>{money.format(Number(b.lesson_price || 0))}</strong></td>
              <td><span className={`premium-status ${!charge ? "premium-status-danger" : ""}`}>{lessonStatus(b.status)}</span></td>
              <td>{!charge ? <span className="premium-status premium-status-warn">Não cobrada</span> : <span className={`premium-status ${paidStatus ? "" : "premium-status-warn"}`}>{paidStatus ? "Pago" : "Pendente"}</span>}</td>
              <td>{paidStatus ? paymentMethod(b.payment_method) : "—"}</td>
              <td>{charge && !paidStatus ? <PixPaymentButton amount={money.format(Number(b.lesson_price || 0))} teacher={teacher} subject={b.subject} lessonDate={dateTime.format(new Date(b.starts_at))} pixKey={pixKey} pixReceiver={pixReceiver}/> : paidStatus ? <span className="payment-paid-note">Confirmado{b.paid_at ? ` em ${dateOnly.format(new Date(b.paid_at))}` : ""}</span> : "—"}</td>
            </tr>;
          })}
          {rows.length === 0 && <tr><td colSpan={8}>Nenhuma aula encontrada no período.</td></tr>}
        </tbody></table></div>
      </PremiumPanel>
    </PremiumPage>
  );
}
