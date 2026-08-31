import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNavigation from "@/components/admin-navigation";

type UtilityIconName = "chat" | "search" | "bell";

function UtilityIcon({
  name,
  size = 20,
}: {
  name: UtilityIconName;
  size?: number;
}) {
  const paths: Record<UtilityIconName, ReactNode> = {
    chat: (
      <>
        <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4.5A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, status")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    redirect("/dashboard");
  }

  const displayName =
    profile.full_name || profile.email.split("@")[0];

  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="ec-shell">
      <aside className="ec-sidebar">
        <Link href="/dashboard" className="ec-brand">
          <span className="ec-brand-mark">E</span>

          <span>
            escola<span className="ec-brand-accent">conecta</span>
          </span>
        </Link>

        <p className="ec-nav-label">AMBIENTE ESCOLAR</p>

        <AdminNavigation />

        <section className="ec-support">
          <div className="ec-support-icon">
            <UtilityIcon name="chat" />
          </div>

          <strong>Precisa de ajuda?</strong>

          <p>Nossa equipe está pronta para apoiar você.</p>

          <span className="ec-support-link">Falar com suporte</span>
        </section>

        <div className="ec-profile">
          <div className="ec-avatar">{initials}</div>

          <div className="ec-profile-copy">
            <strong>{displayName}</strong>
            <span>Administrador</span>
            <small className="ec-profile-email">{profile.email}</small>
          </div>
        </div>
      </aside>

      <main className="ec-main">
        <header className="ec-topbar">
          <Link href="/dashboard" className="ec-mobile-brand">
            <span className="ec-brand-mark">E</span>

            <span>
              escola<span className="ec-brand-accent">conecta</span>
            </span>
          </Link>

          <label className="ec-search">
            <UtilityIcon name="search" size={18} />

            <input
              aria-label="Buscar"
              placeholder="Buscar cursos, turmas ou usuários..."
              readOnly
            />
          </label>

          <div className="ec-identity">
            <span>🔒</span>

            <div className="ec-identity-copy">
              <strong>Painel administrativo</strong>
              <small>{profile.email}</small>
            </div>
          </div>

          <div className="ec-notification" aria-label="Notificações">
            <UtilityIcon name="bell" size={19} />
          </div>
        </header>

        <div className="ec-content">{children}</div>
      </main>
    </div>
  );
}