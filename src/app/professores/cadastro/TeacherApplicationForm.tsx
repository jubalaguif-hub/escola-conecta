"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Offering = { grade_level: string; subject: string };
const levels = ["Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Superior"];
export default function TeacherApplicationForm({ name, email, userId }: { name: string; email: string; userId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState("");
  const [degree, setDegree] = useState("");
  const [experience, setExperience] = useState("");
  const [bio, setBio] = useState("");
  const [gradeLevel, setGradeLevel] = useState(levels[0]);
  const [subject, setSubject] = useState("");
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function addOffering() {
    const normalized = subject.trim();
    if (!normalized || normalized.length > 100) return;
    if (!offerings.some(item => item.grade_level === gradeLevel && item.subject.toLowerCase() === normalized.toLowerCase()))
      setOfferings(items => [...items, { grade_level: gradeLevel, subject: normalized }]);
    setSubject("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (offerings.length === 0) { setError("Adicione ao menos uma disciplina e nível de ensino."); return; }
    if (photo && (photo.size > 2_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
      setError("Use uma foto JPG, PNG ou WEBP de até 2 MB."); return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      let photoPath: string | null = null;
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("teacher-portraits").upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw uploadError;
        photoPath = path;
      }
      const { error: requestError } = await supabase.rpc("request_teacher_approval", {
        p_full_name: fullName.trim(), p_phone: phone.trim(), p_degree: degree.trim(),
        p_experience: experience.trim(), p_bio: bio.trim(), p_offerings: offerings, p_photo_path: photoPath
      });
      if (requestError) throw requestError;
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar. Tente novamente."); }
    finally { setBusy(false); }
  }
  const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none";
  return <form onSubmit={submit} className="mt-8 space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Nome profissional<input className={field} value={fullName} onChange={e => setFullName(e.target.value)} required minLength={3} maxLength={150}/></label>
      <label className="text-sm font-semibold">E-mail<input className={field} value={email} disabled type="email"/></label>
    </div>
    <label className="block text-sm font-semibold">WhatsApp com DDD<input className={field} value={phone} onChange={e => setPhone(e.target.value)} required minLength={10} maxLength={25} placeholder="(31) 99999-9999"/></label>
    <label className="block text-sm font-semibold">Formação acadêmica<input className={field} value={degree} onChange={e => setDegree(e.target.value)} required maxLength={500} placeholder="Graduação, mestrado, especializações..."/></label>
    <label className="block text-sm font-semibold">Experiência profissional<textarea className={field} rows={3} value={experience} onChange={e => setExperience(e.target.value)} required maxLength={1500}/></label>
    <label className="block text-sm font-semibold">Apresentação para os alunos<textarea className={field} rows={3} value={bio} onChange={e => setBio(e.target.value)} required maxLength={1500}/></label>
    <label className="block text-sm font-semibold">Fotografia profissional (opcional; até 2 MB)<input className={field} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] || null)}/></label>
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <h2 className="font-bold text-[#173B73]">Níveis de ensino e disciplinas</h2>
      <p className="mt-1 text-xs text-slate-600">Cadastre cada combinação que poderá aparecer na sua agenda.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Nível<select className={field} value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}>{levels.map(level => <option key={level}>{level}</option>)}</select></label>
        <label className="text-sm font-semibold">Disciplina<input className={field} value={subject} maxLength={100} onChange={e => setSubject(e.target.value)} placeholder="Ex.: Matemática"/></label>
      </div>
      <button type="button" onClick={addOffering} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow">+ Adicionar disciplina</button>
      <div className="mt-4 flex flex-wrap gap-2">{offerings.map((item,index) => <button key={`${item.grade_level}-${item.subject}`} type="button" onClick={() => setOfferings(items => items.filter((_,i)=>i!==index))} className="rounded-full border border-blue-200 bg-white px-3 py-2 text-xs text-blue-900" title="Remover">{item.grade_level} · {item.subject} ×</button>)}</div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#173B73] px-6 py-4 font-bold text-white disabled:opacity-50">{busy ? "Enviando solicitação..." : "Enviar para aprovação"}</button>
    <p className="text-xs text-slate-500">Seu perfil não será publicado nem terá horários abertos antes da aprovação.</p>
  </form>;
}
