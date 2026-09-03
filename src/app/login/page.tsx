"use client";

import Image from "next/image";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#DBEAFE] px-6 py-10">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#2563EB]/20 blur-3xl" />
      <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-[#FBBF24]/20 blur-3xl" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-8 shadow-2xl shadow-blue-950/15 backdrop-blur sm:p-10">
        <div className="mb-8">
          <div className="mb-7 flex justify-center">
            <Image
              src="/clina-logo.png"
              alt="Clina Aulas Particulares"
              width={360}
              height={240}
              priority
              className="h-auto w-64 object-contain sm:w-72"
            />
          </div>

          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#2563EB]">
            Área do aluno e professor
          </p>

          <h1 className="text-center text-3xl font-bold tracking-tight text-[#1E3A8A]">
            Bem-vindo(a)!
          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-[#64748B]">
            Entre com sua conta Google para acessar sua agenda, aulas e
            informações da plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-5 py-4 font-semibold text-white shadow-lg shadow-blue-600/25 transition duration-200 hover:-translate-y-0.5 hover:bg-[#1E3A8A] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base font-bold text-[#2563EB] shadow-sm">
            G
          </span>

          {loading ? "Redirecionando..." : "Entrar com Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-7 text-center text-xs leading-5 text-[#64748B]">
          Ao continuar, você concorda com os Termos de Uso e a Política de
          Privacidade da Clina Aulas Particulares.
        </p>
      </section>
    </main>
  );
}
