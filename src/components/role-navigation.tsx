"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type IconName = "home" | "video" | "calendar" | "plus" | "book";

type NavItem = { label: string; icon: IconName; href: string };

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5v-16Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function RoleNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  const items: NavItem[] = role === "student"
    ? [
        { label: "Visão geral", icon: "home", href: "/dashboard" },
        { label: "Minhas aulas", icon: "video", href: "/aulas/minhas" },
        { label: "Reservar aula", icon: "plus", href: "/agenda" },
        { label: "Calendário", icon: "calendar", href: "/agenda" },
      ]
    : [
        { label: "Visão geral", icon: "home", href: "/dashboard" },
        { label: "Minhas aulas", icon: "video", href: "/aulas/minhas" },
        ...(role === "teacher" ? [{ label: "Meu ensino", icon: "book" as IconName, href: "/professor/ensino" }] : []),
        { label: "Calendário", icon: "calendar", href: "/agenda" },
      ];

  return (
    <nav className="ec-navigation" aria-label="Navegação principal">
      {items.map((item) => {
        const active = item.href === "/dashboard"
          ? pathname === "/dashboard"
          : item.href === "/agenda"
            ? pathname === "/agenda" || (role === "student" && item.label === "Reservar aula" && pathname.startsWith("/aulas/reservar"))
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={`${item.label}-${item.href}`} href={item.href} className={`ec-nav-item ${active ? "ec-nav-item-active" : ""}`}>
          <span className="ec-nav-icon"><Icon name={item.icon}/></span><span>{item.label}</span>
        </Link>;
      })}
    </nav>
  );
}
