import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type IconName =
  | "home"
  | "book"
  | "layers"
  | "users"
  | "video"
  | "calendar"
  | "check"
  | "money"
  | "chat"
  | "settings"
  | "search"
  | "bell";

type NavigationItem = {
  label: string;
  icon: IconName;
  href?: string;
  active?: boolean;
};

const navigation: NavigationItem[] = [
  {
    label: "Visão geral",
    icon: "home",
    href: "/dashboard",
  },
  {
    label: "Cursos",
    icon: "book",
    href: "/admin/cursos",
    active: true,
  },
  {
    label: "Turmas",
    icon: "layers",
  },
  {
    label: "Usuários",
    icon: "users",
  },
  {
    label: "Aulas",
    icon: "video",
  },
  {
    label: "Calendário",
    icon: "calendar",
  },
  {
    label: "Presenças",
    icon: "check",
  },
  {
    label: "Cobranças",
    icon: "money",
  },
  {
    label: "Comunicações",
    icon: "chat",
  },
  {
    label: "Configurações",
    icon: "settings",
  },
];

function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z" />
        <path d="M4 6.5v13M8 8h8" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    money: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M7 10h.01M17 15h.01M8 15c1.2-2 6.8-2 8 0M12 9v6" />
      </>
    ),
    chat: (
      <>
        <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4.5A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
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

        <nav className="ec-navigation" aria-label="Navegação administrativa">
          {navigation.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={`ec-nav-item ${
                  item.active ? "ec-nav-item-active" : ""
                }`}
              >
                <span className="ec-nav-icon">
                  <Icon name={item.icon} />
                </span>

                <span>{item.label}</span>
              </Link>
            ) : (
              <div
                key={item.label}
                className="ec-nav-item"
                aria-disabled="true"
                title="Este módulo será conectado nas próximas etapas"
              >
                <span className="ec-nav-icon">
                  <Icon name={item.icon} />
                </span>

                <span>{item.label}</span>
              </div>
            )
          )}
        </nav>

        <section className="ec-support">
          <div className="ec-support-icon">
            <Icon name="chat" />
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
            <Icon name="search" size={18} />

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
            <Icon name="bell" size={19} />
          </div>
        </header>

        <div className="ec-content">{children}</div>
      </main>
    </div>
  );
}