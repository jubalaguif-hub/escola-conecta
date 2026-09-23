
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Offering = {
  grade_level: string;
  subject: string;
};

type TeacherOption = {
  id: string;
  label: string;
  subjects: string[];
  offerings: Offering[];
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaultDate?: string;
  subjects?: string[];
  offerings?: Offering[];
  teachers?: TeacherOption[];
  isAdmin?: boolean;
};

const fieldClass =
  "block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function NewAvailabilityModal({
  action,
  defaultDate,
  offerings = [],
  teachers = [],
  isAdmin = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === teacherId),
    [teacherId, teachers]
  );

  const availableOfferings = isAdmin
    ? selectedTeacher?.offerings ?? []
    : offerings;

  const availableLevels = [
    ...new Set(
      availableOfferings
        .map((entry) => entry.grade_level)
        .filter(Boolean)
    ),
  ];

  const availableSubjects = [
    ...new Set(
      availableOfferings
        .filter((entry) => entry.grade_level === gradeLevel)
        .map((entry) => entry.subject)
        .filter(Boolean)
    ),
  ];

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeModal() {
    setOpen(false);
    setTeacherId("");
    setGradeLevel("");
  }

  const hasRegisteredOfferings = availableLevels.length > 0;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-availability-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          closeModal();
        }
      }}
    >
      <div
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-[560px] min-w-0 overflow-y-auto rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
        style={{ boxSizing: "border-box" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
              Disponibilidade
            </p>

            <h2
              id="new-availability-title"
              className="mt-1 text-xl font-extrabold text-slate-950"
            >
              Adicionar novo horário
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              {isAdmin
                ? "Escolha o professor e disponibilize um horário em nome dele."
                : "Informe quando a aula poderá ser reservada."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form action={action} className="space-y-5 px-5 py-6 sm:px-7">
          {isAdmin && (
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="availability-teacher"
                className="block text-sm font-semibold text-slate-700"
              >
                Professor
              </label>

              <select
                id="availability-teacher"
                name="teacher_id"
                value={teacherId}
                onChange={(event) => {
                  setTeacherId(event.target.value);
                  setGradeLevel("");
                }}
                required
                className={fieldClass}
              >
                <option value="">Selecione um professor</option>

                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.label}
                  </option>
                ))}
              </select>

              <p className="text-xs leading-5 text-slate-500">
                As matérias serão carregadas do cadastro do professor escolhido.
              </p>
            </div>
          )}

          <div className="min-w-0 space-y-2">
            <label
              htmlFor="availability-grade"
              className="block text-sm font-semibold text-slate-700"
            >
              Nível de ensino
            </label>

            <select
              id="availability-grade"
              name="grade_level"
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              required
              className={fieldClass}
            >
              <option value="">Selecione o nível de ensino</option>

              {availableLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 space-y-2">
            <label
              htmlFor="availability-subject"
              className="block text-sm font-semibold text-slate-700"
            >
              Matéria da aula
            </label>

            {availableSubjects.length > 0 ? (
              <>
                <select
                  id="availability-subject"
                  key={`${teacherId}-${gradeLevel}`}
                  name="subject"
                  defaultValue={
                    availableSubjects.length === 1
                      ? availableSubjects[0]
                      : ""
                  }
                  required
                  className={fieldClass}
                >
                  {availableSubjects.length > 1 && (
                    <option value="">Selecione uma matéria</option>
                  )}

                  {availableSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>

                <p className="text-xs leading-5 text-slate-500">
                  As opções vêm das matérias cadastradas para este professor.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-600">
                {isAdmin && !teacherId
                  ? "Selecione um professor para carregar os níveis e as matérias."
                  : !hasRegisteredOfferings
                    ? "Este professor ainda não possui níveis e matérias cadastrados."
                    : !gradeLevel
                      ? "Selecione primeiro o nível de ensino para visualizar as matérias."
                      : "Não há matérias cadastradas para o nível selecionado."}
              </div>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="availability-date"
                className="block text-sm font-semibold text-slate-700"
              >
                Data
              </label>

              <input
                id="availability-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                required
                className={fieldClass}
                style={{ boxSizing: "border-box" }}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <label
                htmlFor="availability-time"
                className="block text-sm font-semibold text-slate-700"
              >
                Horário de início
              </label>

              <input
                id="availability-time"
                name="time"
                type="time"
                step="300"
                required
                className={fieldClass}
                style={{ boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="availability-duration"
                className="block text-sm font-semibold text-slate-700"
              >
                Duração
              </label>

              <select
                id="availability-duration"
                name="duration"
                defaultValue="60"
                required
                className={fieldClass}
              >
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1h30</option>
                <option value="120">2 horas</option>
              </select>
            </div>

            <div className="min-w-0 space-y-2">
              <label
                htmlFor="availability-price"
                className="block text-sm font-semibold text-slate-700"
              >
                Valor da aula
              </label>

              <div className="relative min-w-0">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">
                  R$
                </span>

                <input
                  id="availability-price"
                  name="price"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="100,00"
                  required
                  className={`${fieldClass} pl-11`}
                  style={{ boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-600">
            O horário ficará disponível para reserva. A matéria e o professor
            ficarão vinculados a este horário.
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                !gradeLevel ||
                availableSubjects.length === 0 ||
                (isAdmin && !teacherId)
              }
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Disponibilizar horário
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
      >
        <span className="text-lg leading-none">＋</span>
        Novo horário
      </button>

      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}