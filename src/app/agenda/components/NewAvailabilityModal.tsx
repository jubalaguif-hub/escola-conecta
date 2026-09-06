"use client";

import { useEffect, useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaultDate?: string;
  subjects: string[];
};

export default function NewAvailabilityModal({ action, defaultDate, subjects }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
      >
        <span className="text-lg leading-none">＋</span>
        Novo horário
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-availability-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Disponibilidade</p>
                <h2 id="new-availability-title" className="mt-1 text-xl font-extrabold text-slate-950">
                  Adicionar novo horário
                </h2>
                <p className="mt-1 text-sm text-slate-500">Informe quando a aula poderá ser reservada.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form action={action} className="space-y-5 px-6 py-6">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Matéria da aula</span>
                {subjects.length > 0 ? (
                  <>
                    <select
                      name="subject"
                      defaultValue={subjects.length === 1 ? subjects[0] : ""}
                      required
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      {subjects.length > 1 && <option value="">Selecione uma matéria</option>}
                      {subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">
                      As opções vêm das matérias cadastradas no seu perfil de professor.
                    </p>
                  </>
                ) : (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    Nenhuma matéria foi cadastrada no seu perfil. Cadastre suas matérias antes de disponibilizar um horário.
                  </div>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Data</span>
                  <input
                    name="date"
                    type="date"
                    defaultValue={defaultDate}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Horário de início</span>
                  <input
                    name="time"
                    type="time"
                    step="300"
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Duração</span>
                  <select
                    name="duration"
                    defaultValue="60"
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1h30</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Valor da aula</span>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">R$</span>
                    <input
                      name="price"
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="100,00"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </label>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-600">
                O horário ficará disponível para reserva. O aluno confirma a aula mediante o sinal configurado na plataforma.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={subjects.length === 0}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Disponibilizar horário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
