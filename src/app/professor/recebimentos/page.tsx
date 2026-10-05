import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

type Props = { searchParams: Promise<{ month?: string; payment?: string }> };
type Booking = { id:string; student_name:string; subject:string; starts_at:string; status:string; lesson_price:number|string; payment_status:"pending"|"paid"; paid_at:string|null; payment_method:string|null };
function defaultMonth(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"}).formatToParts(new Date());return `${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}`;}
function range(v:string){const safe=/^(\d{4})-(\d{2})$/.test(v)?v:defaultMonth();const [y,m]=safe.split("-").map(Number);const ny=m===12?y+1:y,nm=m===12?1:m+1;return{value:safe,start:`${y}-${String(m).padStart(2,"0")}-01T00:00:00-03:00`,end:`${ny}-${String(nm).padStart(2,"0")}-01T00:00:00-03:00`};}
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const dt=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"});
function lessonStatus(s:string){if(s==="scheduled")return"Agendada";if(s==="completed")return"Realizada";if(s==="no_show")return"Aluno ausente";if(s==="teacher_no_show")return"Professor ausente";if(s==="cancelled")return"Cancelada";return s;}

export default async function TeacherReceiptsPage({searchParams}:Props){
  const params=await searchParams; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role,status").eq("id",user.id).single(); if(profile?.role!=="teacher"||profile.status!=="active")redirect("/dashboard");
  const r=range(params.month||defaultMonth()); const selected=params.payment||"";
  let q=supabase.from("lesson_bookings").select("id,student_name,subject,starts_at,status,lesson_price,payment_status,paid_at,payment_method").eq("teacher_id",user.id).gte("starts_at",r.start).lt("starts_at",r.end).order("starts_at",{ascending:false});
  if(selected)q=q.eq("payment_status",selected); const {data,error}=await q; const rows=(data||[]) as Booking[]; const chargeable=rows.filter(x=>x.status!=="cancelled"&&x.status!=="teacher_no_show");
  const received=chargeable.filter(x=>x.payment_status==="paid").reduce((s,x)=>s+Number(x.lesson_price||0),0); const pending=chargeable.filter(x=>x.payment_status==="pending").reduce((s,x)=>s+Number(x.lesson_price||0),0); const expected=received+pending;
  return <PremiumPage eyebrow="Meus recebimentos" title="Meus recebimentos" description="Acompanhe os valores das suas aulas. O valor mostrado é o que foi registrado no momento da reserva." metrics={[
    {label:"Valor previsto",value:money.format(expected),icon:"R$",hint:`${chargeable.length} aula(s) não cancelada(s)`},{label:"Recebido",value:money.format(received),icon:"✓",hint:"Pagamentos confirmados pelo admin"},{label:"A receber",value:money.format(pending),icon:"↗",hint:"Pagamentos ainda pendentes"},{label:"Aulas canceladas",value:String(rows.filter(x=>x.status==="cancelled").length),icon:"×",hint:"Não entram nos totais"},
  ]}>
    <form method="get"><PremiumToolbar><label><span>Competência</span><input type="month" name="month" defaultValue={r.value}/></label><label><span>Pagamento</span><select name="payment" defaultValue={selected}><option value="">Todos</option><option value="pending">Pendente</option><option value="paid">Pago</option></select></label><button className="premium-filter-button" type="submit">⌕ Filtrar</button></PremiumToolbar></form>
    {error&&<p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Não foi possível carregar seus recebimentos. Confirme se a migration financeira foi executada.</p>}
    <PremiumPanel title="Minhas aulas e valores" subtitle="O professor consulta os próprios valores; a confirmação de pagamento é feita pelo administrador."><div className="premium-table-wrap"><table className="premium-table"><thead><tr><th>Data</th><th>Aluno</th><th>Matéria</th><th>Valor</th><th>Aula</th><th>Pagamento</th><th>Confirmação</th></tr></thead><tbody>
      {rows.map(b=><tr key={b.id}><td>{dt.format(new Date(b.starts_at))}</td><td><strong>{b.student_name}</strong></td><td>{b.subject}</td><td><strong>{money.format(Number(b.lesson_price||0))}</strong></td><td>{lessonStatus(b.status)}</td><td>{(b.status==="cancelled"||b.status==="teacher_no_show")?<span className="premium-status premium-status-warn">Não cobrada</span>:<span className={`premium-status ${b.payment_status==="pending"?"premium-status-warn":""}`}>{b.payment_status==="paid"?"Pago":"Pendente"}</span>}</td><td>{b.payment_status==="paid"&&b.status!=="cancelled"&&b.status!=="teacher_no_show"?`${b.payment_method==="pix"?"PIX":b.payment_method==="cash"?"Dinheiro":b.payment_method==="card"?"Cartão":b.payment_method==="transfer"?"Transferência":"Outro"}${b.paid_at?` · ${dt.format(new Date(b.paid_at))}`:""}`:"—"}</td></tr>)}
      {rows.length===0&&<tr><td colSpan={7}>Nenhuma aula encontrada no período.</td></tr>}
    </tbody></table></div></PremiumPanel>
  </PremiumPage>;
}
