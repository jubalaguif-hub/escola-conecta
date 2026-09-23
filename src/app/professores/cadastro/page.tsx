import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeacherApplicationForm from "./TeacherApplicationForm";

export default async function TeacherApplicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/professores/cadastro");
  const { data: profile } = await supabase.from("profiles").select("role,status,full_name,email").eq("id",user.id).single();
  if (profile?.role === "teacher" && profile.status === "active") redirect("/agenda");
  const { data: application } = await supabase.from("teacher_applications")
    .select("status,review_notes,created_at").eq("user_id",user.id).maybeSingle();
  return <main className="min-h-screen bg-[#f5f8fe] px-5 py-12 text-slate-800">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm font-semibold text-blue-700">← Escola Conecta</Link>
      <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Faça parte da nossa equipe</p>
        <h1 className="mt-2 text-3xl font-bold text-[#173B73]">Cadastro de professor</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Apresente sua experiência e as disciplinas que oferece. Sua conta docente e sua agenda serão liberadas somente após aprovação do administrador.</p>
        {application?.status === "pending" ? <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><strong>Solicitação recebida.</strong><p className="mt-1 text-sm">Seu cadastro está aguardando avaliação. Você não pode abrir agenda como professor enquanto não houver aprovação.</p></div> : null}
        {application?.status === "rejected" ? <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900"><strong>Solicitação não aprovada.</strong><p className="mt-1 text-sm">{application.review_notes || "Entre em contato com a administração para mais informações."}</p></div> : null}
        {!application && <TeacherApplicationForm name={profile?.full_name || user.user_metadata?.full_name || ""} email={profile?.email || user.email || ""} userId={user.id} />}
      </div>
    </div>
  </main>;
}
