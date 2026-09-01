import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

const statusLabels: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
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
      {
        label: "Visão geral",
        icon: "home",
        href: "/dashboard",
        active: true,
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
        href: "/agenda",
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
  }

  if (role === "teacher") {
    return [
      {
        label: "Visão geral",
        icon: "home",
        href: "/dashboard",
        active: true,
      },
      {
        label: "Minhas turmas",
        icon: "users",
      },
      {
        label: "Aulas ao vivo",
        icon: "video",
      },
      {
        label: "Gravações",
        icon: "book",
      },
      {
        label: "Calendário",
        icon: "calendar",
        href: "/agenda",
      },
      {
        label: "Presenças",
        icon: "check",
      },
      {
        label: "Comunicações",
        icon: "chat",
      },
      {
        label: "Materiais",
        icon: "layers",
      },
    ];
  }

  return [
    {
      label: "Visão geral",
      icon: "home",
      href: "/dashboard",
      active: true,
    },
    {
      label: "Aulas ao vivo",
      icon: "video",
    },
    {
      label: "Gravações",
      icon: "book",
    },
    {
      label: "Calendário",
      icon: "calendar",
        href: "/agenda",
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
      label: "Materiais",
      icon: "layers",
    },
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
            da Escola Conecta.
          </p>
        </div>
      </main>
    );
  }

  const isAdmin = profile.role === "admin";

  const [
    coursesResult,
    classesResult,
    lessonsResult,
    enrollmentsResult,
    recentCoursesResult,
  ] = isAdmin
    ? await Promise.all([
        supabase
          .from("courses")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("classes")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("lessons")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("courses")
          .select("id, title, workload_hours, status")
          .order("created_at", { ascending: false })
          .limit(5),
      ])
    : [
        { count: 0 },
        { count: 0 },
        { count: 0 },
        { count: 0 },
        { data: [] },
      ];

  const recentCourses = recentCoursesResult.data || [];
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
              placeholder="Buscar aulas, alunos ou materiais..."
              readOnly
            />
          </label>

          <div className="ec-identity">
            <span>🔒</span>

            <div className="ec-identity-copy">
              <strong>
                {isAdmin ? "Painel administrativo" : "Meu ambiente"}
              </strong>

              <small>{profile.email}</small>
            </div>
          </div>

          <div className="ec-notification" aria-label="Notificações">
            <Icon name="bell" size={19} />
          </div>
        </header>

        <div className="ec-content">
          <section className="ec-privacy">
            <div className="ec-privacy-icon">
              <Icon name="shield" />
            </div>

            <div className="ec-privacy-copy">
              <strong>
                {isAdmin
                  ? "Ambiente administrativo protegido"
                  : "Este ambiente é somente seu"}
              </strong>

              <p>
                {isAdmin
                  ? "Cadastros, permissões e informações acadêmicas são acessíveis somente aos perfis autorizados."
                  : "Suas aulas, mensagens, presença e materiais são exibidos conforme o seu perfil."}
              </p>
            </div>

            <span className="ec-protected">🔒 Acesso restrito</span>
          </section>

          <section className="ec-welcome">
            <div>
              <p className="ec-eyebrow">{currentDate}</p>

              <h1>
                Olá, {firstName}! <span>👋</span>
              </h1>

              <p>
                {isAdmin
                  ? "Organize a estrutura acadêmica e os acessos da Escola Conecta."
                  : "Acompanhe sua rotina escolar e tudo o que foi preparado para você."}
              </p>
            </div>
          </section>

          {isAdmin ? (
            <>
              <section className="ec-primary-hero">
                <div className="ec-hero-copy">
                  <span className="ec-hero-label">
                    ESTRUTURA ACADÊMICA
                  </span>

                  <h2>
                    {coursesResult.count || 0}{" "}
                    {(coursesResult.count || 0) === 1
                      ? "curso cadastrado"
                      : "cursos cadastrados"}
                  </h2>

                  <p>
                    Cadastre cursos e prepare a organização das turmas,
                    professores, alunos e aulas.
                  </p>
                </div>

                <Link href="/admin/cursos" className="ec-hero-button">
                  Gerenciar cursos
                  <Icon name="arrow" size={17} />
                </Link>
              </section>

              <section className="ec-quick-grid">
                <Link href="/admin/cursos" className="ec-quick-card">
                  <span className="ec-quick-icon ec-quick-purple">
                    <Icon name="plus" />
                  </span>

                  <span className="ec-quick-copy">
                    <strong>Cadastrar curso</strong>
                    <small>Adicionar um novo curso</small>
                  </span>
                </Link>

                <div className="ec-quick-card" aria-disabled="true">
                  <span className="ec-quick-icon ec-quick-green">
                    <Icon name="layers" />
                  </span>

                  <span className="ec-quick-copy">
                    <strong>Organizar turmas</strong>
                    <small>Próximo módulo</small>
                  </span>
                </div>

                <Link href="/admin/usuarios" className="ec-quick-card">
                  <span className="ec-quick-icon ec-quick-orange">
                    <Icon name="users" />
                  </span>

                  <span className="ec-quick-copy">
                    <strong>Gerenciar usuários</strong>
                    <small>Professores e alunos</small>
                  </span>
                </Link>
              </section>

              <div className="ec-dashboard-grid">
                <section className="ec-panel">
                  <div className="ec-panel-header">
                    <div>
                      <h2>Cursos recentes</h2>
                      <p>Últimos cadastros realizados na plataforma</p>
                    </div>

                    <Link
                      href="/admin/cursos"
                      className="text-sm font-semibold text-violet-600 no-underline"
                    >
                      Ver todos
                    </Link>
                  </div>

                  {recentCourses.length === 0 ? (
                    <div className="ec-empty">
                      Nenhum curso cadastrado ainda.
                    </div>
                  ) : (
                    <div className="ec-list">
                      {recentCourses.map((course) => (
                        <article key={course.id} className="ec-list-item">
                          <span className="ec-list-marker" />

                          <div className="ec-list-copy">
                            <strong>{course.title}</strong>

                            <span>
                              {course.workload_hours !== null
                                ? `${course.workload_hours} horas`
                                : "Carga horária não informada"}
                            </span>
                          </div>

                          <span className="ec-status">
                            {statusLabels[course.status] || course.status}
                          </span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <aside className="ec-panel">
                  <div className="ec-panel-header">
                    <div>
                      <h3>Resumo acadêmico</h3>
                      <p>Estrutura cadastrada</p>
                    </div>
                  </div>

                  <div className="ec-stat-grid">
                    <article className="ec-stat">
                      <span>Cursos</span>
                      <strong>{coursesResult.count || 0}</strong>
                    </article>

                    <article className="ec-stat">
                      <span>Turmas</span>
                      <strong>{classesResult.count || 0}</strong>
                    </article>

                    <article className="ec-stat">
                      <span>Aulas</span>
                      <strong>{lessonsResult.count || 0}</strong>
                    </article>

                    <article className="ec-stat">
                      <span>Matrículas</span>
                      <strong>{enrollmentsResult.count || 0}</strong>
                    </article>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <section className="ec-primary-hero">
              <div className="ec-hero-copy">
                <span className="ec-hero-label">
                  {profile.role === "teacher"
                    ? "AMBIENTE DO PROFESSOR"
                    : "MEU MURAL"}
                </span>

                <h2>
                  {profile.role === "teacher"
                    ? "Suas turmas e aulas em um só lugar"
                    : "Sua rotina escolar organizada"}
                </h2>

                <p>
                  Este painel será preenchido automaticamente quando houver
                  turmas, aulas e materiais vinculados ao seu perfil.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
