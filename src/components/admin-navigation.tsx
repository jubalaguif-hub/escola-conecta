"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  | "settings";

type NavigationItem = {
  label: string;
  icon: IconName;
  href?: string;
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
  },
  {
    label: "Turmas",
    icon: "layers",
  },
  {
    label: "Usuários",
    icon: "users",
    href: "/admin/usuarios",
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

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="ec-navigation" aria-label="Navegação administrativa">
      {navigation.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : item.href
              ? pathname === item.href ||
                pathname.startsWith(`${item.href}/`)
              : false;

        if (!item.href) {
          return (
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
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`ec-nav-item ${
              isActive ? "ec-nav-item-active" : ""
            }`}
          >
            <span className="ec-nav-icon">
              <Icon name={item.icon} />
            </span>

            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}