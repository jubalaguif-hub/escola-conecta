import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoleNavigation from "@/components/role-navigation";
import NotificationBell, { type PlatformNotification } from "@/components/notification-bell";
import SignOutButton from "@/components/sign-out-button";

function Icon({ name }: { name: "search" | "chat" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chat: <><path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4.5A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  } as const;
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default async function ProfessorLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("full_name,email,role,status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/dashboard");
  if (profile.role !== "teacher") redirect("/dashboard");

  const { data: notificationRows } = await supabase.from("notifications")
    .select("id,title,message,href,created_at,read_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifications = (notificationRows || []) as PlatformNotification[];
  const name = profile.full_name || profile.email.split("@")[0];
  const initials = name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="ec-shell premium-shell">
      <aside className="ec-sidebar premium-sidebar">
        <Link href="/dashboard" className="ec-brand-logo" aria-label="Eliane Aulas Particulares">
          <Image src="/clina-logo.png" alt="Eliane Aulas Particulares" width={300} height={180} priority />
        </Link>
        <p className="ec-nav-label">PLATAFORMA EDUCACIONAL</p>
        <RoleNavigation role={profile.role} />

        <section className="ec-support premium-support">
          <div className="ec-support-icon"><Icon name="chat" /></div>
          <strong>Precisa de ajuda?</strong>
          <p>Nossa equipe está pronta para apoiar você.</p>
          <span className="ec-support-link">Falar com suporte</span>
        </section>

        <SignOutButton />
        <div className="ec-profile premium-profile">
          <div className="ec-avatar">{initials}</div>
          <div className="ec-profile-copy">
            <strong>{name}</strong>
            <span>Professor</span>
            <small className="ec-profile-email">{profile.email}</small>
          </div>
        </div>
      </aside>

      <main className="ec-main premium-main">
        <header className="ec-topbar premium-topbar">
          <label className="ec-search premium-search">
            <Icon name="search" />
            <input aria-label="Buscar" placeholder="Buscar aulas, alunos ou materiais..." readOnly />
          </label>
          <div className="premium-top-actions">
            <NotificationBell initialNotifications={notifications} />
            <Link href="/dashboard" className="ec-identity premium-identity ec-identity-link" title="Voltar para a visão geral">
              <div className="ec-avatar premium-mini-avatar">{initials}</div>
              <div className="ec-identity-copy"><strong>Meu ambiente</strong><small>{profile.email}</small></div>
            </Link>
          </div>
        </header>
        <div className="ec-content premium-content">{children}</div>
      </main>
    </div>
  );
}
