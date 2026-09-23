import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
export default async function AdminAulas() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const {data:profile} = await supabase.from("profiles").select("role,status").eq("id",user.id).single();
  if (profile?.role !== "admin" || profile.status !== "active") redirect("/dashboard");
  const {data:bookings,error} = await supabase.from("lesson_bookings")
    .select("id,student_name,student_phone,subject,grade_level,teacher_id,starts_at,status")
    .order("starts_at",{ascending:false}).limit(500);
  const list = bookings || [];
  const names: Record<string,string> = {scheduled:"Agendadas",completed:"Realizadas",no_show:"Ausências",cancelled:"Canceladas"};
  const fmt = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"});
  return <div className="premium-page p-6 text-slate-900">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Escola Conecta • Administração</p>
    <h1 className="mt-2 text-3xl font-extrabold">Controle de aulas</h1>
    <p className="mt-2 text-sm text-slate-500">Dados reais registrados pela plataforma; não são números ilustrativos.</p>
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(names).map(([key,label]) => <div key={key} className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="text-3xl text-blue-900">{list.filter(b=>b.status===key).length}</strong></div>)}</div>
    {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">Aplique e valide a migração de agendamentos antes de utilizar esta tela.</p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-blue-50"><tr>{["Aluno","Disciplina","Data","Situação"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{list.map(b=><tr key={b.id} className="border-t"><td className="p-3">{b.student_name}</td><td className="p-3">{b.subject}{b.grade_level?` • ${b.grade_level}`:""}</td><td className="p-3">{fmt.format(new Date(b.starts_at))}</td><td className="p-3">{names[b.status]||b.status}</td></tr>)}</tbody></table></div>
    <Link href="/aulas/minhas" className="mt-6 inline-block rounded-xl bg-blue-800 px-5 py-3 font-semibold text-white">Finalizar aulas e consultar detalhes →</Link>
  </div>;
}
