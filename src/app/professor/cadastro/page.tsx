import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TeacherSignupForm from "./TeacherSignupForm";

export default async function TeacherRegistration({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}) {
 const q=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 const {data:profile}=user ? await supabase.from("profiles").select("role,status,full_name").eq("id",user.id).maybeSingle() : {data:null};
 return <main className="min-h-screen bg-[#f5f8ff] px-5 py-10 text-slate-800"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-xl shadow-blue-950/10 sm:p-10">
 <Link href="/" className="text-sm font-semibold text-blue-700">← Voltar à Escola Conecta</Link>
 <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-blue-700">Escola Conecta</p>
 <h1 className="mt-2 text-3xl font-bold text-[#173b73]">Cadastrar como professor</h1>
 <p className="mt-3 text-sm text-slate-600">Você não precisa se cadastrar como aluno. Informe seus dados profissionais e confirme sua conta Google para enviar a solicitação. Sua agenda só será liberada após aprovação.</p>
 {q.error&&<p role="alert" className="my-5 rounded-xl bg-red-50 p-4 text-red-800">Não foi possível concluir a autenticação. Tente novamente.</p>}
 {q.sent&&<p className="my-5 rounded-xl bg-green-50 p-4 text-green-800">Solicitação recebida. Aguarde a análise do administrador.</p>}
 {profile?.role==='teacher'&&<p className="my-5 rounded-xl bg-blue-50 p-4 text-blue-800">Situação: {profile.status==='active'?'aprovado':profile.status==='pending'?'aguardando aprovação':'cadastro não ativo'}.</p>}
 {profile?.role==='admin'||profile?.role==='coordinator'||profile?.role==='finance'||profile?.status==='blocked'||profile?.role==='teacher' ? null : <TeacherSignupForm userEmail={user?.email||""} userName={profile?.full_name||user?.user_metadata?.full_name||""} />}
 </div></main>;
}
