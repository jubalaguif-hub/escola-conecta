"use client";

import { useState } from "react";

export type Offering = { grade_level: string; subject: string };

const levels = ["Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Superior"];

export default function SubjectPicker({ initialOfferings }: { initialOfferings?: Offering[] }) {
  const [rows, setRows] = useState<Offering[]>(
    initialOfferings?.length ? initialOfferings : [{ grade_level: "", subject: "" }]
  );

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 font-semibold">Níveis de ensino e disciplinas</legend>
      <input type="hidden" name="offerings" value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div className="flex flex-wrap gap-2" key={i}>
          <select
            required
            aria-label={`Nível ${i + 1}`}
            value={row.grade_level}
            onChange={(e) => setRows((old) => old.map((x, j) => i === j ? { ...x, grade_level: e.target.value } : x))}
            className="min-w-40 flex-1 rounded-xl border p-3"
          >
            <option value="">Selecione o nível</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <input
            required
            maxLength={100}
            aria-label={`Disciplina ${i + 1}`}
            placeholder="Ex.: Matemática"
            value={row.subject}
            onChange={(e) => setRows((old) => old.map((x, j) => i === j ? { ...x, subject: e.target.value } : x))}
            className="min-w-40 flex-1 rounded-xl border p-3"
          />
          <button type="button" aria-label="Remover disciplina" disabled={rows.length === 1}
            onClick={() => setRows((old) => old.filter((_, j) => i !== j))}
            className="rounded-xl border px-3 disabled:opacity-30">×</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((old) => [...old, { grade_level: "", subject: "" }])}
        className="rounded-xl bg-blue-50 px-4 py-2 font-semibold text-blue-700">
        + Adicionar outra disciplina
      </button>
    </fieldset>
  );
}
