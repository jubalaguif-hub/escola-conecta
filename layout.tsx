import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNavigation from "@/components/admin-navigation";
import { signOut } from "@/app/actions/auth";

function Icon({ name }: { name: "search" | "bell" | "chat" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chat: <><path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4.5A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  } as const;
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

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
    <div className="ec-shell premium-shell">
      <aside className="ec-sidebar premium-sidebar">
        <Link href="/dashboard" className="ec-brand-logo" aria-label="Eliane Aulas Particulares">
          <Image src="/clina-logo.png" alt="Eliane Aulas Particulares" width={300} height={180} priority />
        </Link>

        <p className="ec-nav-label">PLATAFORMA EDUCACIONAL</p>

        {isAdmin ? (
          <AdminNavigation />
        ) : (
          <nav className="ec-navigation" aria-label="Navegação principal">
            <Link href="/dashboard" className="ec-nav-item"><span className="ec-nav-icon">⌂</span><span>Visão geral</span></Link>
            <Link href="/agenda" className="ec-nav-item ec-nav-item-active"><span className="ec-nav-icon">◷</span><span>Calendário</span></Link>
          </nav>
        )}

        <section className="ec-support premium-support">
          <div className="ec-support-icon"><Icon name="chat" /></div>
          <strong>Precisa de ajuda?</strong>
          <p>Nossa equipe está pronta para apoiar você.</p>
          <span className="ec-support-link">Falar com suporte</span>
        </section>

        <form action={signOut} className="premium-signout">
          <button type="submit" className="ec-nav-item w-full text-left"><span className="ec-nav-icon">↪</span><span>Sair</span></button>
        </form>

        <div className="ec-profile premium-profile">
          <div className="ec-avatar">{initials}</div>
          <div className="ec-profile-copy"><strong>{name}</strong><span>{isAdmin ? "Administrador" : "Professor / Aluno"}</span><small className="ec-profile-email">{profile.email}</small></div>
        </div>
      </aside>

      <main className="ec-main premium-main">
        <header className="ec-topbar premium-topbar">
          <label className="ec-search premium-search">
            <Icon name="search" />
            <input aria-label="Buscar" placeholder="Buscar aulas, alunos ou materiais..." readOnly />
          </label>
          <div className="premium-top-actions">
            <div className="ec-notification premium-notification" aria-label="Notificações"><Icon name="bell" /><span className="premium-dot" /></div>
            <div className="ec-identity premium-identity">
              <div className="ec-avatar premium-mini-avatar">{initials}</div>
              <div className="ec-identity-copy"><strong>Painel administrativo</strong><small>{profile.email}</small></div>
              <span className="premium-chevron">⌄</span>
            </div>
          </div>
        </header>
        <div className="ec-content premium-content">{children}</div>
      </main>
    </div>
  );
}
