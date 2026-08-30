"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active && user) {
        router.replace("/dashboard");
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function signInWithGoogle() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (authError) {
      setError("Não foi possível iniciar o acesso com Google.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
            EC
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Escola Conecta
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Bem-vindo à sua plataforma acadêmica
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Entre com sua conta Google para acessar aulas, materiais,
            gravações, presença e informações acadêmicas.
          </p>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3.5 font-semibold text-slate-800 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg font-bold text-blue-600 shadow-sm">
            G
          </span>

          {loading ? "Redirecionando..." : "Entrar com Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-7 text-center text-xs leading-5 text-slate-500">
          Ao continuar, você concorda com os Termos de Uso e a Política de
          Privacidade da Escola Conecta.
        </p>
      </section>
    </main>
  );
}