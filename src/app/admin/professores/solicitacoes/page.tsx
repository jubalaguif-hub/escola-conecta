import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import PendingSubmitButton from "@/components/pending-submit-button";
async function review(formData:FormData){
 "use server";
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect('/login');
 const {data:admin}=await supabase.from('profiles').select('role,status').eq('id',user.id).single();
 if(admin?.role!=='admin'||admin.status!=='active') redirect('/dashboard');
 const teacher=String(formData.get('teacher_id')||'');
 const {error}=await supabase.rpc('review_teacher_profile',{p_teacher_id:teacher,p_approve:formData.get('decision')==='approve'});
 if(error) redirect('/admin/professores/solicitacoes?error='+encodeURIComponent(error.message));
 revalidatePath('/admin/professores/solicitacoes');revalidatePath('/admin/professores');
 redirect('/admin/professores/solicitacoes?updated=1');
}
export default async function Approvals({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}){
 const q=await searchParams;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect('/login');
 const {data:admin}=await supabase.from('profiles').select('role,status').eq('id',user.id).single();
 if(admin?.role!=='admin'||admin.status!=='active') redirect('/dashboard');
 const {data:requests,error}=await supabase.from('profiles').select('id,full_name,email,teacher_education,teacher_experience,teacher_bio,notification_phone,teacher_photo_url,teaching_offerings,teacher_requested_at').eq('role','teacher').eq('status','pending').not('teacher_requested_at','is',null).order('teacher_requested_at',{ascending:true});
 return <main className="space-y-6"><Link className="text-sm font-semibold text-blue-700" href="/admin/professores">← Professores</Link><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Escola Conecta</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Solicitações de professores</h1><p className="text-slate-500">A agenda só será liberada após a sua aprovação.</p></div>
 {q.error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{q.error}</p>}{q.updated&&<p className="rounded-xl bg-green-50 p-4 text-green-700">Decisão registrada.</p>}
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">Não foi possível carregar solicitações: {error.message}</p>}
 {!requests?.length&&!error&&<div className="rounded-xl bg-white p-6">Nenhuma solicitação pendente.</div>}
 <div className="grid gap-5">{requests?.map(t=><article key={t.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-[#173b73]">{t.full_name||t.email}</h2><p className="text-sm text-slate-500">{t.email} • {t.notification_phone||'WhatsApp não informado'}</p>
 <dl className="mt-4 grid gap-2 text-sm"><div><dt className="font-semibold">Formação</dt><dd>{t.teacher_education||'Não informada'}</dd></div><div><dt className="font-semibold">Experiência</dt><dd>{t.teacher_experience||'Não informada'}</dd></div><div><dt className="font-semibold">Apresentação</dt><dd>{t.teacher_bio||'Não informada'}</dd></div><div><dt className="font-semibold">Níveis e matérias</dt><dd>{Array.isArray(t.teaching_offerings)?t.teaching_offerings.map((o:{grade_level:string;subject:string})=>`${o.grade_level}: ${o.subject}`).join(' • '):''}</dd></div></dl>
 {t.teacher_photo_url&&<a href={t.teacher_photo_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-blue-700 underline">Ver foto informada</a>}
 <div className="mt-5 flex flex-wrap gap-3"><form action={review}><input type="hidden" name="teacher_id" value={t.id}/><input type="hidden" name="decision" value="approve"/><PendingSubmitButton pendingLabel="Aprovando..." className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white">Aprovar</PendingSubmitButton></form><form action={review}><input type="hidden" name="teacher_id" value={t.id}/><input type="hidden" name="decision" value="reject"/><PendingSubmitButton pendingLabel="Registrando..." className="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700">Rejeitar</PendingSubmitButton></form></div></article>)}</div></main>;
}
