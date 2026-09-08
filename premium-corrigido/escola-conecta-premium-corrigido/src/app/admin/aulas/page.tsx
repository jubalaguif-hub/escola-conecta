import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

const lessons = [
  ["Matemática", "João Silva", "Hoje, 09:00 – 10:00", "Confirmada"],
  ["Português", "Maria Oliveira", "Hoje, 14:00 – 15:00", "Confirmada"],
  ["Inglês", "Carlos Mendes", "Amanhã, 10:30 – 11:30", "Agendada"],
];

export default function ClassesPage() {
  return (
    <PremiumPage
      eyebrow="Aulas"
      title="Gestão de aulas"
      description="Acompanhe aulas agendadas, professores, matérias e horários em uma visão centralizada."
      actionLabel="Nova aula"
      metrics={[
        { label: "Aulas esta semana", value: "12", icon: "▣", hint: "+3 vs. semana anterior" },
        { label: "Confirmadas", value: "9", icon: "✓", hint: "75% da agenda" },
        { label: "Professores", value: "6", icon: "♙", hint: "Com aulas agendadas" },
        { label: "Horas previstas", value: "14h", icon: "◷", hint: "Carga semanal" },
      ]}
    >
      <PremiumToolbar>
        <label><span>Buscar aula</span><input placeholder="Matéria, professor ou aluno..." /></label>
        <label><span>Período</span><select defaultValue="week"><option value="week">Esta semana</option><option>Este mês</option></select></label>
        <label><span>Status</span><select defaultValue="all"><option value="all">Todos</option><option>Confirmada</option><option>Agendada</option></select></label>
        <button className="premium-filter-button">⌕ Filtrar</button>
      </PremiumToolbar>
      <PremiumPanel title="Próximas aulas" subtitle="Agenda organizada por data e horário">
        <div className="premium-table-wrap">
          <table className="premium-table"><thead><tr><th>Matéria</th><th>Professor</th><th>Data e horário</th><th>Status</th></tr></thead>
          <tbody>{lessons.map((r) => <tr key={r.join("-")}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td><span className="premium-status">{r[3]}</span></td></tr>)}</tbody></table>
        </div>
      </PremiumPanel>
    </PremiumPage>
  );
}
