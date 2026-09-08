import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
  }>;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenação",
  teacher: "Professor",
  student: "Aluno",
  finance: "Financeiro",
};

const statusLabels: Record<string, string> = {
  pending: "Aguardando liberação",
  active: "Ativo",
  blocked: "Bloqueado",
  inactive: "Inativo",
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-800",
  inactive: "bg-slate-200 text-slate-700",
};

const allowedRoles = [
  "admin",
  "coordinator",
  "teacher",
  "student",
  "finance",
];

const allowedStatuses = [
  "pending",
  "active",
  "blocked",
  "inactive",
];

async function getAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.status !== "active") {
    redirect("/dashboard");
  }

  return { supabase, user };
}

async function updateUserAccess(formData: FormData) {
  "use server";

  const { supabase, user } = await getAdmin();

  const profileId = String(formData.get("profile_id") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const status = String(formData.get("status") || "").trim();

  if (!profileId) {
    redirect(
      "/admin/usuarios?error=Não%20foi%20possível%20identificar%20o%20usuário."
    );
  }

  if (profileId === user.id) {
    redirect(
      "/admin/usuarios?error=Seu%20próprio%20perfil%20administrativo%20não%20pode%20ser%20alterado%20nesta%20tela."
    );
  }

  if (!allowedRoles.includes(role)) {
    redirect(
      "/admin/usuarios?error=O%20perfil%20selecionado%20é%20inválido."
    );
  }

  if (!allowedStatuses.includes(status)) {
    redirect(
      "/admin/usuarios?error=A%20situação%20selecionada%20é%20inválida."
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      status,
    })
    .eq("id", profileId);

  if (error) {
    redirect(
      "/admin/usuarios?error=Não%20foi%20possível%20atualizar%20o%20acesso."
    );
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/dashboard");
  redirect("/admin/usuarios?updated=1");
}

export default async function UsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getAdmin();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("created_at", { ascending: false });

  const users = profiles || [];

  const pendingCount = users.filter(
    (profile) => profile.status === "pending"
  ).length;

  const activeCount = users.filter(
    (profile) => profile.status === "active"
  ).length;

  const teacherCount = users.filter(
    (profile) => profile.role === "teacher"
  ).length;

  const studentCount = users.filter(
    (profile) => profile.role === "student"
  ).length;

  return (
    <>
      <section className="mb-7">
        <p className="ec-eyebrow">ACESSOS E PERMISSÕES</p>

        <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-900">
          Gerenciar usuários
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Defina quem é professor, aluno, coordenação ou financeiro e controle
          a liberação individual de cada acesso.
        </p>
      </section>

      {params.updated === "1" && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Acesso atualizado com sucesso.
        </p>
      )}

      {params.error && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {params.error}
        </p>
      )}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Usuários ativos
          </span>

          <strong className="mt-3 block text-3xl text-slate-900">
            {activeCount}
          </strong>
        </article>

        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Aguardando
          </span>

          <strong className="mt-3 block text-3xl text-slate-900">
            {pendingCount}
          </strong>
        </article>

        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-600">
            Professores
          </span>

          <strong className="mt-3 block text-3xl text-slate-900">
            {teacherCount}
          </strong>
        </article>

        <article className="ec-panel">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Alunos
          </span>

          <strong className="mt-3 block text-3xl text-slate-900">
            {studentCount}
          </strong>
        </article>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="m-0 text-xl font-bold text-slate-900">
            Pessoas cadastradas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {users.length}{" "}
            {users.length === 1
              ? "usuário encontrado"
              : "usuários encontrados"}
          </p>
        </div>

        {users.length === 0 ? (
          <div className="ec-panel text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-2xl">
              👥
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900">
              Nenhum usuário localizado
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Novos usuários aparecerão aqui após o primeiro acesso com Google.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((profile) => {
              const displayName =
                profile.full_name || profile.email.split("@")[0];

              const initials = displayName
                .split(" ")
                .map((part: string) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const isCurrentAdmin = profile.id === user.id;

              return (
                <article key={profile.id} className="ec-panel">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="ec-avatar h-12 w-12 shrink-0 text-sm">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="m-0 text-lg font-bold text-slate-900">
                        {displayName}
                      </h3>

                      <p className="mt-1 break-all text-sm text-slate-500">
                        {profile.email}
                      </p>

                      <p className="mt-2 text-sm font-semibold text-violet-700">
                        {roleLabels[profile.role] || profile.role}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        statusStyles[profile.status] || statusStyles.inactive
                      }`}
                    >
                      {statusLabels[profile.status] || profile.status}
                    </span>
                  </div>

                  {isCurrentAdmin ? (
                    <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                      Este é o seu perfil administrador. Para evitar a perda
                      acidental de acesso, ele não pode ser alterado nesta tela.
                    </div>
                  ) : (
                    <form
                      action={updateUserAccess}
                      className="mt-5 grid items-end gap-4 border-t border-slate-200 pt-5 md:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        type="hidden"
                        name="profile_id"
                        value={profile.id}
                      />

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Perfil
                        </span>

                        <select
                          name="role"
                          defaultValue={profile.role}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        >
                          <option value="teacher">Professor</option>
                          <option value="student">Aluno</option>
                          <option value="coordinator">Coordenação</option>
                          <option value="finance">Financeiro</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Situação
                        </span>

                        <select
                          name="status"
                          defaultValue={profile.status}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        >
                          <option value="pending">
                            Aguardando liberação
                          </option>

                          <option value="active">Ativo</option>
                          <option value="blocked">Bloqueado</option>
                          <option value="inactive">Inativo</option>
                        </select>
                      </label>

                      <button
                        type="submit"
                        className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700"
                      >
                        Salvar acesso
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}