import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationBell, { type PlatformNotification } from "@/components/notification-bell";
import SignOutButton from "@/components/sign-out-button";

type IconName =
  | "home"
  | "book"
  | "users"
  | "video"
  | "calendar"
  | "check"
  | "money"
  | "chat"
  | "settings"
  | "search"
  | "shield"
  | "bell"
  | "arrow"
  | "plus"
  | "layers";

type NavItem = {
  label: string;
  icon: IconName;
  href?: string;
  active?: boolean;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenação",
  teacher: "Professor",
  student: "Aluno",
  finance: "Financeiro",
};

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
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
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

function getNavigation(role: string): NavItem[] {
  if (role === "admin") {
    return [
      { label: "Visão geral", icon: "home", href: "/dashboard", active: true },
      { label: "Usuários", icon: "users", href: "/admin/usuarios" },
      { label: "Professores", icon: "users", href: "/admin/professores" },
      { label: "Aulas", icon: "video", href: "/admin/aulas" },
      { label: "Calendário", icon: "calendar", href: "/agenda" },
      { label: "Presenças", icon: "check", href: "/admin/presencas" },
      { label: "Cobranças", icon: "money", href: "/admin/cobrancas" },
      { label: "Comunicações", icon: "chat", href: "/admin/comunicacoes" },
      { label: "Configurações", icon: "settings", href: "/admin/configuracoes" },
    ];
  }

  if (role === "teacher") {
    return [
      { label: "Visão geral", icon: "home", href: "/dashboard", active: true },
      { label: "Minhas aulas", icon: "video", href: "/aulas/minhas" },
      { label: "Meu ensino", icon: "book", href: "/professor/ensino" },
      { label: "Calendário", icon: "calendar", href: "/agenda" },
    ];
  }

  return [
    { label: "Visão geral", icon: "home", href: "/dashboard", active: true },
    { label: "Minhas aulas", icon: "video", href: "/aulas/minhas" },
    { label: "Reservar aula", icon: "plus", href: "/aulas/reservar" },
    { label: "Calendário", icon: "calendar", href: "/agenda" },
  ];
}

export default async function DashboardPage() {
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

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">
            Perfil não localizado
          </h1>

          <p className="mt-3 text-slate-600">
            Não foi possível carregar seu perfil. Procure o administrador.
          </p>
        </div>
      </main>
    );
  }

  if (profile.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ⏳
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Cadastro aguardando liberação
          </h1>

          <p className="mt-3 text-slate-600">
            Seu acesso foi registrado e precisa ser aprovado pelo administrador
            da Clina Aulas Particulares.
          </p>
        </div>
      </main>
    );
  }

  const isAdmin = profile.role === "admin";
  const isTeacher = profile.role === "teacher";

  const teacherBookingsResult = isTeacher
    ? await supabase
        .from("lesson_bookings")
        .select("id,student_name,subject,grade_level,starts_at,ends_at,status")
        .eq("teacher_id", user.id)
        .order("starts_at", { ascending: true })
        .limit(200)
    : { data: [] as Array<{ id: string; student_name: string; subject: string; grade_level: string | null; starts_at: string; ends_at: string; status: string }> };

  const teacherAvailabilityResult = isTeacher
    ? await supabase
        .from("availability_slots")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id)
        .eq("status", "available")
        .gte("starts_at", new Date().toISOString())
    : { count: 0 };

  const { data: notificationRows } = await supabase
    .from("notifications")
    .select("id,title,message,href,created_at,read_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const notifications = (notificationRows || []) as PlatformNotification[];

  const [lessonsResult, enrollmentsResult, teachersResult, studentsResult] = isAdmin
    ? await Promise.all([
        supabase.from("lessons").select("*", { count: "exact", head: true }),
        supabase.from("enrollments").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  const firstName =
    profile.full_name?.split(" ")[0] || profile.email.split("@")[0];

  const initials = (profile.full_name || profile.email)
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date())
    .toUpperCase();

  const navigation = getNavigation(profile.role);

  const teacherBookings = teacherBookingsResult.data || [];
  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const upcomingTeacherLessons = teacherBookings
    .filter((booking) => booking.status === "scheduled" && new Date(booking.starts_at) >= now)
    .slice(0, 4);
  const nextTeacherLesson = upcomingTeacherLessons[0] || null;
  const teacherWeekCount = teacherBookings.filter((booking) => {
    const startsAt = new Date(booking.starts_at);
    return booking.status === "scheduled" && startsAt >= now && startsAt <= weekAhead;
  }).length;
  const teacherCompletedCount = teacherBookings.filter((booking) => booking.status === "completed").length;
  const teacherNoShowCount = teacherBookings.filter((booking) => booking.status === "no_show").length;
  const formatShortDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
  const formatTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

  return (
    <div className="ec-shell">
      <aside className="ec-sidebar">
        <Link
          href="/dashboard"
          className="ec-brand-logo"
          aria-label="Clina Aulas Particulares"
        >
          <Image
            src="/clina-logo.png"
            alt="Clina Aulas Particulares"
            width={300}
            height={180}
            priority
          />
        </Link>

        <p className="ec-nav-label">PLATAFORMA EDUCACIONAL</p>

        <nav className="ec-navigation" aria-label="Navegação principal">
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

        <SignOutButton />

        <div className="ec-profile">
          <div className="ec-avatar">{initials}</div>

          <div className="ec-profile-copy">
            <strong>{profile.full_name || firstName}</strong>

            <span>{roleLabels[profile.role] || profile.role}</span>

            <small className="ec-profile-email">{profile.email}</small>
          </div>
        </div>
      </aside>

      <main className="ec-main">
        <header className="ec-topbar">
          <Link
            href="/dashboard"
            className="ec-mobile-brand-logo"
            aria-label="Clina Aulas Particulares"
          >
            <Image
              src="/clina-logo.png"
              alt="Clina Aulas Particulares"
              width={220}
              height={130}
              priority
            />
          </Link>

          <label className="ec-search">
            <Icon name="search" size={18} />

            <input
              aria-label="Buscar"
              placeholder="Buscar aulas, alunos ou materiais..."
              readOnly
            />
          </label>

          <Link href="/dashboard" className="ec-identity ec-identity-link" title="Visão geral">
            <span>🔒</span>

            <div className="ec-identity-copy">
              <strong>
                {isAdmin ? "Painel administrativo" : "Meu ambiente"}
              </strong>

              <small>{profile.email}</small>
            </div>
          </Link>

          <NotificationBell initialNotifications={notifications} />
        </header>

        <div className="ec-content ec-content-premium">
          {profile.role === "student" && <Link href="/professor/cadastro" className="mb-5 inline-block rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-[#173b73]">Quero ser professor — solicitar cadastro →</Link>}

          {isAdmin ? (
            <>
              <section className="premium-dashboard-hero">
                <div className="premium-dashboard-copy">
                  <p className="ec-eyebrow">{currentDate}</p>
                  <h1>Olá, {firstName}! <span>👋</span></h1>
                  <p>Tenha uma visão rápida da operação acadêmica, acessos e agenda da Clina.</p>
                  <div className="premium-dashboard-actions">
                    <Link href="/agenda" className="premium-primary-action"><Icon name="calendar" size={18} /> Ver calendário</Link>
                    <Link href="/admin/usuarios" className="premium-secondary-action"><Icon name="users" size={18} /> Gerenciar usuários</Link>
                  </div>
                </div>
                <div className="premium-dashboard-art" aria-hidden="true">
                  <div className="premium-art-ring premium-art-ring-one" />
                  <div className="premium-art-ring premium-art-ring-two" />
                  <div className="premium-art-calendar">
                    <div className="premium-art-calendar-top"><span/><span/></div>
                    <div className="premium-art-calendar-grid">
                      {Array.from({ length: 9 }).map((_, index) => <i key={index} />)}
                    </div>
                  </div>
                  <div className="premium-art-clock"><span /></div>
                  <div className="premium-art-claim">Educação<br/>que transforma<br/><strong>realidades</strong></div>
                </div>
              </section>

              <section className="premium-metrics-grid">
                <article className="premium-metric-card"><span className="premium-metric-icon"><Icon name="video" /></span><div><strong>{lessonsResult.count || 0}</strong><small>Aulas cadastradas</small></div></article>
                <article className="premium-metric-card"><span className="premium-metric-icon"><Icon name="users" /></span><div><strong>{teachersResult.count || 0}</strong><small>Professores</small></div></article>
                <article className="premium-metric-card"><span className="premium-metric-icon"><Icon name="book" /></span><div><strong>{studentsResult.count || 0}</strong><small>Alunos</small></div></article>
                <article className="premium-metric-card"><span className="premium-metric-icon"><Icon name="layers" /></span><div><strong>{enrollmentsResult.count || 0}</strong><small>Matrículas</small></div></article>
              </section>

              <section className="premium-dashboard-grid">
                <article className="premium-dashboard-panel">
                  <div className="premium-panel-title"><div><span>ACESSOS RÁPIDOS</span><h2>Administração</h2></div><small>Atalhos principais</small></div>
                  <div className="premium-shortcuts">
                    <Link href="/admin/usuarios"><span><Icon name="users" /></span><div><strong>Usuários</strong><small>Permissões e acessos</small></div><b>→</b></Link>
                    <Link href="/admin/professores"><span><Icon name="users" /></span><div><strong>Professores</strong><small>Equipe pedagógica</small></div><b>→</b></Link>
                    <Link href="/agenda"><span><Icon name="calendar" /></span><div><strong>Calendário</strong><small>Agenda semanal</small></div><b>→</b></Link>
                  </div>
                </article>
                <article className="premium-dashboard-panel premium-status-panel">
                  <div className="premium-panel-title"><div><span>SEGURANÇA</span><h2>Ambiente protegido</h2></div></div>
                  <div className="premium-security-badge"><Icon name="shield" size={28} /><div><strong>Acesso administrativo</strong><small>Cadastros e informações acadêmicas visíveis somente para perfis autorizados.</small></div></div>
                </article>
              </section>
            </>
          ) : isTeacher ? (
            <>
              <section className="teacher-premium-hero">
                <div className="teacher-premium-copy">
                  <p className="ec-eyebrow">{currentDate}</p>
                  <span className="teacher-premium-label">AMBIENTE DO PROFESSOR</span>
                  <h1>Olá, {firstName}!</h1>
                  <p>Acompanhe suas próximas aulas, disponibilidades e resultados em um único lugar.</p>
                  <div className="teacher-premium-actions">
                    <Link href="/agenda" className="premium-primary-action"><Icon name="calendar" size={18} /> Ver calendário</Link>
                    <Link href="/aulas/minhas" className="premium-secondary-action"><Icon name="video" size={18} /> Minhas aulas</Link>
                  </div>
                </div>
                <div className="teacher-next-card">
                  <span className="teacher-next-kicker">PRÓXIMA AULA</span>
                  {nextTeacherLesson ? (
                    <>
                      <strong>{nextTeacherLesson.subject}{nextTeacherLesson.grade_level ? ` · ${nextTeacherLesson.grade_level}` : ""}</strong>
                      <b>{formatShortDate(nextTeacherLesson.starts_at)}</b>
                      <small>Aluno: {nextTeacherLesson.student_name}</small>
                    </>
                  ) : (
                    <>
                      <strong>Nenhuma aula futura agendada</strong>
                      <small>Crie novos horários no calendário para receber reservas.</small>
                    </>
                  )}
                </div>
              </section>

              <section className="teacher-metrics-grid">
                <article className="teacher-metric-card"><span><Icon name="calendar" /></span><div><strong>{teacherWeekCount}</strong><small>Aulas nos próximos 7 dias</small></div></article>
                <article className="teacher-metric-card"><span><Icon name="plus" /></span><div><strong>{teacherAvailabilityResult.count || 0}</strong><small>Horários disponíveis</small></div></article>
                <article className="teacher-metric-card"><span><Icon name="check" /></span><div><strong>{teacherCompletedCount}</strong><small>Aulas realizadas</small></div></article>
                <article className="teacher-metric-card"><span><Icon name="users" /></span><div><strong>{teacherNoShowCount}</strong><small>Ausências registradas</small></div></article>
              </section>

              <section className="teacher-dashboard-grid">
                <article className="teacher-lessons-panel">
                  <div className="teacher-panel-head">
                    <div><span>AGENDA</span><h2>Próximas aulas</h2><p>Reservas confirmadas vinculadas ao seu perfil.</p></div>
                    <Link href="/aulas/minhas">Ver todas →</Link>
                  </div>
                  <div className="teacher-lessons-list">
                    {upcomingTeacherLessons.length ? upcomingTeacherLessons.map((booking) => (
                      <Link href="/aulas/minhas" key={booking.id} className="teacher-lesson-row">
                        <div className="teacher-date-box"><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(booking.starts_at))}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(booking.starts_at)).replace(".", "")}</span></div>
                        <div className="teacher-lesson-copy"><strong>{booking.subject}{booking.grade_level ? ` · ${booking.grade_level}` : ""}</strong><span>{formatTime(booking.starts_at)}–{formatTime(booking.ends_at)} · Aluno: {booking.student_name}</span></div>
                        <span className="teacher-status-pill">Agendada</span>
                        <b>→</b>
                      </Link>
                    )) : <div className="teacher-empty-state">Nenhuma aula futura agendada no momento.</div>}
                  </div>
                </article>

                <article className="teacher-actions-panel">
                  <div className="teacher-panel-head"><div><span>ATALHOS</span><h2>Ações rápidas</h2></div></div>
                  <Link href="/agenda" className="teacher-action-card"><span><Icon name="plus" /></span><div><strong>Criar disponibilidade</strong><small>Abra novos horários no calendário</small></div><b>→</b></Link>
                  <Link href="/aulas/minhas" className="teacher-action-card"><span><Icon name="video" /></span><div><strong>Gerenciar aulas</strong><small>Consulte agendadas e realizadas</small></div><b>→</b></Link>
                  <Link href="/professor/ensino" className="teacher-action-card"><span><Icon name="book" /></span><div><strong>Meu ensino</strong><small>Edite área, níveis e matérias</small></div><b>→</b></Link>
                </article>
              </section>
            </>
          ) : (
            <section className="ec-primary-hero">
              <div className="ec-hero-copy">
                <span className="ec-hero-label">MEU MURAL</span>
                <h2>Sua rotina escolar organizada</h2>
                <p>Acompanhe suas aulas, reservas e materiais vinculados ao seu perfil.</p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
