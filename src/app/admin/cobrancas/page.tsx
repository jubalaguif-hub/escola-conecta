import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";
import AdminPaymentButton from "./AdminPaymentButton";

type Props = { searchParams: Promise<{ month?: string; teacher?: string; payment?: string }> };
type Booking = { id:string; teacher_id:string; student_name:string; subject:string; starts_at:string; status:string; lesson_price:number|string; payment_status:"pending"|"paid"; paid_at:string|null; payment_method:string|null; payment_note:string|null };
type Teacher = { id:string; full_name:string|null; email:string };

function defaultMonth(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"}).formatToParts(new Date());return `${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}`;}
function monthRange(v:string){const safe=/^(\d{4})-(\d{2})$/.test(v)?v:defaultMonth();const[y,m]=safe.split("-").map(Number);const ny=m===12?y+1:y,nm=m===12?1:m+1;return{value:safe,start:`${y}-${String(m).padStart(2,"0")}-01T00:00:00-03:00`,end:`${ny}-${String(nm).padStart(2,"0")}-01T00:00:00-03:00`};}
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"});
const dateOnly=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"America/Sao_Paulo"});
function teacherName(t?:Teacher){return t?.full_name||t?.email?.split("@")[0]||"Professor";}
function chargeable(s:string){return s!=="cancelled"&&s!=="teacher_no_show";}
function lessonStatus(s:string){if(s==="scheduled")return"Agendada";if(s==="completed")return"Realizada";if(s==="no_show")return"Aluno ausente";if(s==="teacher_no_show")return"Professor ausente";if(s==="cancelled")return"Cancelada";return s;}
function paymentMethod(m:string|null){if(m==="pix")return"PIX";if(m==="cash")return"Dinheiro";if(m==="card")return"Cartão";if(m==="transfer")return"Transferência";if(m==="other")return"Outro";return"—";}

async function updatePaymentStatus(formData:FormData){
  "use server";
  const bookingId=String(formData.get("booking_id")||""); const paymentStatus=String(formData.get("payment_status")||"");
  if(!bookingId||!["pending","paid"].includes(paymentStatus))return;
  const method=String(formData.get("payment_method")||"")||null;
  const paidAtRaw=String(formData.get("paid_at")||"");
  const paidAt=paidAtRaw?new Date(paidAtRaw).toISOString():null;
  const note=String(formData.get("payment_note")||"").trim()||null;
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_lesson_payment_status",{p_booking_id:bookingId,p_payment_status:paymentStatus,p_payment_method:method,p_paid_at:paidAt,p_payment_note:note});
  if(error)throw new Error(error.message);
  revalidatePath("/admin/cobrancas"); revalidatePath("/professor/recebimentos"); revalidatePath("/aulas/pagamentos");
}

export default async function BillingPage({searchParams}:Props){
  const params=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role,status").eq("id",user.id).single(); if(profile?.role!=="admin"||profile.status!=="active")redirect("/dashboard");
  const range=monthRange(params.month||defaultMonth()); const selectedTeacher=params.teacher||""; const selectedPayment=params.payment||"";
  const {data:teacherRows}=await supabase.from("profiles").select("id,full_name,email").eq("role","teacher").eq("status","active").order("full_name"); const teachers=(teacherRows||[]) as Teacher[]; const teacherMap=new Map(teachers.map(t=>[t.id,t]));
  let base=supabase.from("lesson_bookings").select("id,teacher_id,student_name,subject,starts_at,status,lesson_price,payment_status,paid_at,payment_method,payment_note").gte("starts_at",range.start).lt("starts_at",range.end).order("starts_at",{ascending:false}); if(selectedTeacher)base=base.eq("teacher_id",selectedTeacher);
  const {data:allData,error:allError}=await base; const allRows=(allData||[]) as Booking[];
  const rows=selectedPayment?allRows.filter(r=>r.payment_status===selectedPayment):allRows;
  const valid=allRows.filter(r=>chargeable(r.status)); const received=valid.filter(r=>r.payment_status==="paid").reduce((s,r)=>s+Number(r.lesson_price||0),0); const pending=valid.filter(r=>r.payment_status==="pending").reduce((s,r)=>s+Number(r.lesson_price||0),0); const expected=received+pending; const rate=expected>0?received/expected*100:0;
  const summary=teachers.map(t=>{const rs=allRows.filter(r=>r.teacher_id===t.id&&chargeable(r.status));const rec=rs.filter(r=>r.payment_status==="paid").reduce((s,r)=>s+Number(r.lesson_price||0),0);const pend=rs.filter(r=>r.payment_status==="pending").reduce((s,r)=>s+Number(r.lesson_price||0),0);return{teacher:t,count:rs.length,expected:rec+pend,received:rec,pending:pend};}).filter(x=>x.count>0);

  return <PremiumPage eyebrow="Cobranças" title="Financeiro por aula" description="O preço da reserva é preservado. Somente o administrador/financeiro confirma pagamentos." metrics={[
    {label:"Total previsto",value:money.format(expected),icon:"R$",hint:`${valid.length} aula(s) cobrada(s)`},{label:"Recebido",value:money.format(received),icon:"✓",hint:`${valid.filter(r=>r.payment_status==="paid").length} pagamento(s)`},{label:"A receber",value:money.format(pending),icon:"↗",hint:`${valid.filter(r=>r.payment_status==="pending").length} pendência(s)`},{label:"Taxa recebida",value:`${rate.toFixed(1).replace(".",",")}%`,icon:"%",hint:"Sobre o valor previsto"},
  ]}>
    <form method="get"><PremiumToolbar><label><span>Competência</span><input type="month" name="month" defaultValue={range.value}/></label><label><span>Professor</span><select name="teacher" defaultValue={selectedTeacher}><option value="">Todos</option>{teachers.map(t=><option key={t.id} value={t.id}>{teacherName(t)}</option>)}</select></label><label><span>Pagamento</span><select name="payment" defaultValue={selectedPayment}><option value="">Todos</option><option value="pending">Pendente</option><option value="paid">Pago</option></select></label><button className="premium-filter-button" type="submit">⌕ Filtrar</button></PremiumToolbar></form>
    {allError&&<p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Não foi possível carregar as cobranças. Execute a atualização financeira no Supabase.</p>}
    <PremiumPanel title="Resumo por professor" subtitle="Visão gerencial dos valores de cada professor na competência selecionada."><div className="premium-table-wrap"><table className="premium-table"><thead><tr><th>Professor</th><th>Aulas cobradas</th><th>Previsto</th><th>Recebido</th><th>A receber</th></tr></thead><tbody>{summary.map(x=><tr key={x.teacher.id}><td><strong>{teacherName(x.teacher)}</strong></td><td>{x.count}</td><td>{money.format(x.expected)}</td><td>{money.format(x.received)}</td><td>{money.format(x.pending)}</td></tr>)}{summary.length===0&&<tr><td colSpan={5}>Nenhuma cobrança para resumir no período.</td></tr>}</tbody></table></div></PremiumPanel>
    <div style={{height:18}}/>
    <PremiumPanel title="Cobranças por aula" subtitle="Aulas canceladas ou com ausência do professor permanecem no histórico, mas não são cobradas."><div className="premium-table-wrap"><table className="premium-table"><thead><tr><th>Data</th><th>Aluno</th><th>Professor</th><th>Aula</th><th>Valor</th><th>Situação</th><th>Pagamento</th><th>Forma / data</th><th>Ação</th></tr></thead><tbody>{rows.map(b=>{const teacher=teacherMap.get(b.teacher_id);const canCharge=chargeable(b.status);return <tr key={b.id}><td>{dateTime.format(new Date(b.starts_at))}</td><td><strong>{b.student_name}</strong></td><td>{teacherName(teacher)}</td><td>{b.subject}</td><td><strong>{money.format(Number(b.lesson_price||0))}</strong></td><td><span className={`premium-status ${!canCharge?"premium-status-danger":""}`}>{lessonStatus(b.status)}</span></td><td>{!canCharge?<span className="premium-status premium-status-warn">Não cobrada</span>:<span className={`premium-status ${b.payment_status==="pending"?"premium-status-warn":""}`}>{b.payment_status==="paid"?"Pago":"Pendente"}</span>}</td><td>{b.payment_status==="paid"&&canCharge?<><strong>{paymentMethod(b.payment_method)}</strong><br/><small>{b.paid_at?dateOnly.format(new Date(b.paid_at)):"—"}{b.payment_note?` · ${b.payment_note}`:""}</small></>:"—"}</td><td>{canCharge&&<AdminPaymentButton bookingId={b.id} amount={money.format(Number(b.lesson_price||0))} currentStatus={b.payment_status} currentMethod={b.payment_method} currentPaidAt={b.paid_at} currentNote={b.payment_note} action={updatePaymentStatus}/>}</td></tr>})}{rows.length===0&&<tr><td colSpan={9}>Nenhuma aula encontrada no período.</td></tr>}</tbody></table></div></PremiumPanel>
  </PremiumPage>;
}
