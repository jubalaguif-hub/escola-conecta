import PremiumPage, { PremiumPanel } from "@/components/premium-page";

export default function CommunicationsPage() {
  return (
    <PremiumPage eyebrow="Comunicações" title="Central de comunicações" description="Envie avisos e acompanhe mensagens importantes para professores, alunos e responsáveis." actionLabel="Nova mensagem" metrics={[
      { label: "Enviadas no mês", value: "38", icon: "✉", hint: "+8 esta semana" },
      { label: "Taxa de leitura", value: "96%", icon: "✓", hint: "Excelente alcance" },
      { label: "Não lidas", value: "5", icon: "●", hint: "Precisam de atenção" },
      { label: "Rascunhos", value: "2", icon: "✎", hint: "Em preparação" },
    ]}>
      <div className="premium-two-columns">
        <PremiumPanel title="Mensagens recentes" subtitle="Últimas comunicações enviadas">
          <div className="premium-message-list">
            {[
              ["Lembrete de aula", "Turma de Matemática", "Hoje, 09:15", "A aula de amanhã está confirmada para as 14h."],
              ["Novo material disponível", "Todos os alunos", "Ontem, 17:40", "A lista de exercícios desta semana já está disponível."],
              ["Alteração de horário", "Responsáveis", "07/09, 11:20", "O horário da aula de sexta-feira foi atualizado."],
            ].map((m)=><article key={m[0]}><div className="premium-message-icon">✉</div><div><strong>{m[0]}</strong><span>{m[1]} • {m[2]}</span><p>{m[3]}</p></div></article>)}
          </div>
        </PremiumPanel>
        <PremiumPanel title="Canais" subtitle="Visão rápida por público">
          <div className="premium-channel-grid"><article><b>Professores</b><span>12 mensagens</span></article><article><b>Alunos</b><span>18 mensagens</span></article><article><b>Responsáveis</b><span>8 mensagens</span></article></div>
        </PremiumPanel>
      </div>
    </PremiumPage>
  );
}
