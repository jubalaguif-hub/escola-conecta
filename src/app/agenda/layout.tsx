import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function AgendaLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/dashboard");

  const name = profile.full_name || profile.email.split("@")[0];
  const initials = name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
  const isAdmin = profile.role === "admin";

  return (
    <div className="ec-shell">
      <aside className="ec-sidebar">
        <Link href="/dashboard" className="ec-brand">
          <span className="ec-brand-mark">E</span>
          <span>escola<span className="ec-brand-accent">conecta</span></span>
        </Link>

        <p className="ec-nav-label">AMBIENTE ESCOLAR</p>

        <nav className="ec-navigation" aria-label="Navegação principal">
          <Link href="/dashboard" className="ec-nav-item"><span className="ec-nav-icon">⌂</span><span>Visão geral</span></Link>
          {isAdmin && <Link href="/admin/cursos" className="ec-nav-item"><span className="ec-nav-icon">▣</span><span>Cursos</span></Link>}
          {isAdmin && <Link href="/admin/usuarios" className="ec-nav-item"><span className="ec-nav-icon">♧</span><span>Usuários</span></Link>}
          <Link href="/agenda" className="ec-nav-item ec-nav-item-active"><span className="ec-nav-icon">◷</span><span>Calendário</span></Link>
        </nav>

        <form action={signOut} className="mt-auto">
          <button type="submit" className="ec-nav-item w-full text-left"><span className="ec-nav-icon">↪</span><span>Sair</span></button>
        </form>

        <div className="ec-profile">
          <div className="ec-avatar">{initials}</div>
          <div className="ec-profile-copy"><strong>{name}</strong><span>{isAdmin ? "Administrador" : "Professor / Aluno"}</span><small className="ec-profile-email">{profile.email}</small></div>
        </div>
      </aside>

      <main className="ec-main"><div className="ec-content">{children}</div></main>
    </div>
  );
}
