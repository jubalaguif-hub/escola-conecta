import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

export default function AttendancePage() {
  return (
    <PremiumPage eyebrow="Presenças" title="Controle de presenças" description="Visualize frequência, faltas e registros pendentes com indicadores rápidos." actionLabel="Registrar presença" metrics={[
      { label: "Presença média", value: "94%", icon: "✓", hint: "+2% neste mês" },
      { label: "Presentes", value: "47", icon: "♙", hint: "Últimos 7 dias" },
      { label: "Faltas", value: "3", icon: "!", hint: "Últimos 7 dias" },
      { label: "Pendentes", value: "2", icon: "◷", hint: "Aguardando registro" },
    ]}>
      <PremiumToolbar>
        <label><span>Aluno</span><input placeholder="Buscar aluno..." /></label><label><span>Professor</span><select><option>Todos os professores</option></select></label><label><span>Período</span><select><option>Este mês</option></select></label><button className="premium-filter-button">⌕ Filtrar</button>
      </PremiumToolbar>
      <PremiumPanel title="Resumo de frequência" subtitle="Acompanhamento consolidado por aluno">
        <div className="premium-list-cards">
          {["Ana Clara","Bruno Lima","Camila Rocha","Diego Alves"].map((name, i)=><article key={name}><div className="premium-person-avatar">{name.split(" ").map(x=>x[0]).join("")}</div><div><strong>{name}</strong><span>Matemática • Setembro</span></div><div className="premium-progress"><i style={{width:`${[100,92,96,88][i]}%`}} /></div><b>{[100,92,96,88][i]}%</b></article>)}
        </div>
      </PremiumPanel>
    </PremiumPage>
  );
}
