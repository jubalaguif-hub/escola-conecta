"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SubjectPicker, { type Offering } from "./SubjectPicker";

const storageKey = "escola_teacher_signup_draft_v1";
const MAX_IMAGE = 5 * 1024 * 1024;

type Draft = {
  full_name: string;
  education: string;
  experience: string;
  bio: string;
  phone: string;
  offerings: Offering[];
};

export default function TeacherSignupForm({ userEmail, userName }: { userEmail: string; userName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState<Draft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setRestored(JSON.parse(raw) as Draft);
    } catch { /* Sem rascunho válido. */ }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function selectPhoto(file: File | null) {
    setError("");
    if (!file) { setPhoto(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Escolha uma foto JPG, PNG ou WebP.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE) {
      setError("A foto deve ter no máximo 5 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPhoto(file);
  }

  async function send(draft: Draft) {
    const supabase = createClient();
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/professor/cadastro`,
            queryParams: { prompt: "select_account" },
          },
        });
        if (oauthError) throw new Error(`Não foi possível iniciar o Google: ${oauthError.message}`);
        return;
      }

      let photoUrl = "";
      if (photo) {
        const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/professional-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("teacher-photos")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw new Error(`Não foi possível enviar a foto: ${uploadError.message}`);
        photoUrl = supabase.storage.from("teacher-photos").getPublicUrl(path).data.publicUrl;
      }

      const { error: rpcError } = await supabase.rpc("request_teacher_profile", {
        p_full_name: draft.full_name,
        p_education: draft.education,
        p_experience: draft.experience,
        p_bio: draft.bio,
        p_phone: draft.phone,
        p_photo_url: photoUrl,
        p_offerings: draft.offerings,
      });
      if (rpcError) throw new Error(rpcError.message);
      sessionStorage.removeItem(storageKey);
      router.replace("/professor/cadastro?sent=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(formData: FormData) {
    let offerings: Offering[];
    try { offerings = JSON.parse(String(formData.get("offerings") || "[]")); }
    catch { setError("Revise as disciplinas."); return; }
    if (!Array.isArray(offerings) || !offerings.length ||
      offerings.some((x) => !x.grade_level || !x.subject?.trim())) {
      setError("Informe nível e disciplina."); return;
    }
    const value = (key: string) => String(formData.get(key) || "").trim();
    await send({
      full_name: value("full_name"), education: value("education"),
      experience: value("experience"), bio: value("bio"),
      phone: value("phone"), offerings,
    });
  }

  // Espera o sessionStorage ser lido antes de montar campos com defaultValue.
  if (!draftLoaded) return <p className="mt-7 text-sm text-slate-600">Carregando formulário...</p>;

  return (
    <form action={submit} className="mt-7 space-y-5">
      {userEmail && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Conta Google: {userEmail}</p>}
      {restored && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Rascunho recuperado. {userEmail ? "Conta confirmada. " : ""}
        Se quiser adicionar uma foto, selecione-a novamente: o navegador não preserva arquivos após sair da página.
      </p>}
      <label className="block text-sm font-semibold">Nome profissional
        <input name="full_name" required minLength={3} maxLength={150} defaultValue={restored?.full_name || userName}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
      </label>
      <label className="block text-sm font-semibold">Formação acadêmica
        <textarea name="education" maxLength={1000} rows={3} defaultValue={restored?.education || ""}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
      </label>
      <label className="block text-sm font-semibold">Experiência
        <textarea name="experience" maxLength={1000} rows={3} defaultValue={restored?.experience || ""}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
      </label>
      <label className="block text-sm font-semibold">Apresentação para os alunos
        <textarea name="bio" maxLength={2000} rows={4} defaultValue={restored?.bio || ""}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
      </label>
      <label className="block text-sm font-semibold">WhatsApp com DDD
        <input name="phone" required minLength={8} maxLength={30} defaultValue={restored?.phone || ""}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
      </label>
      <div className="space-y-2">
        <label htmlFor="teacher-photo" className="block text-sm font-semibold">Foto profissional (opcional)</label>
        <input ref={fileRef} id="teacher-photo" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => selectPhoto(e.target.files?.[0] || null)}
          className="block w-full rounded-xl border border-slate-200 p-3 text-sm" />
        <p className="text-xs text-slate-500">JPG, PNG ou WebP, até 5 MB. Você pode continuar sem foto.</p>
        {preview && <img src={preview} alt="Pré-visualização da foto profissional" className="h-28 w-28 rounded-full border object-cover" />}
        {photo && <button type="button" className="text-sm text-blue-700 underline"
          onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>Remover foto</button>}
      </div>
      <SubjectPicker initialOfferings={restored?.offerings} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[#173b73] p-4 font-semibold text-white disabled:opacity-50">
        {busy ? "Aguarde..." : userEmail ? "Enviar solicitação" : "Confirmar conta Google e continuar"}
      </button>
      <p className="text-xs text-slate-500">Se você ainda não tem conta, o Google criará seu acesso. Após confirmar a conta, você poderá selecionar a foto e enviar a solicitação. A agenda só é liberada após aprovação.</p>
    </form>
  );
}
