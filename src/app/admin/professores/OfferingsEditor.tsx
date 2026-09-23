"use client";

import { useState } from "react";

export type Offering = { grade_level: string; subject: string };
const LEVELS = ["Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Superior"];

export default function OfferingsEditor({ teacherId, initial, action }: {
  teacherId: string;
  initial: Offering[];
  action: (data: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<Offering[]>(initial.length ? initial : [{ grade_level: "", subject: "" }]);
  return <form action={action} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
    <input type="hidden" name="teacher_id" value={teacherId} />
    <input type="hidden" name="offerings" value={JSON.stringify(rows)} />
    <p className="text-sm font-bold text-slate-900">Níveis e matérias atendidos</p>
    <p className="text-xs text-slate-500">Cadastre uma combinação por linha. Ex.: Ensino Médio · Matemática. Para Fundamental I, informe “Todas as disciplinas” se aplicável.</p>
    {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <select aria-label={`Nível ${index + 1}`} required value={row.grade_level} onChange={event => setRows(old => old.map((entry, i) => i === index ? { ...entry, grade_level: event.target.value } : entry))} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900">
        <option value="">Nível</option>{LEVELS.map(level => <option key={level}>{level}</option>)}
      </select>
      <input aria-label={`Matéria ${index + 1}`} required placeholder="Matéria" value={row.subject} onChange={event => setRows(old => old.map((entry, i) => i === index ? { ...entry, subject: event.target.value } : entry))} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900" />
      <button aria-label={`Remover matéria ${index + 1}`} type="button" disabled={rows.length === 1} onClick={() => setRows(old => old.filter((_, i) => i !== index))} className="rounded-xl border border-slate-200 px-3 text-slate-600 disabled:opacity-30">×</button>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setRows(old => [...old, { grade_level: "", subject: "" }])} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">+ Adicionar combinação</button>
      <button type="submit" className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white">Salvar matérias</button>
    </div>
  </form>;
}
