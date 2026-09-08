import PremiumPage, { PremiumPanel, PremiumToolbar } from "@/components/premium-page";

export default function BillingPage() {
  return (
    <PremiumPage eyebrow="Cobranças" title="Financeiro e cobranças" description="Acompanhe recebimentos, vencimentos e pendências com uma visão mais executiva." actionLabel="Nova cobrança" metrics={[
      { label: "Recebido no mês", value: "R$ 8.420", icon: "R$", hint: "+12% no período" },
      { label: "A receber", value: "R$ 2.180", icon: "↗", hint: "7 cobranças" },
      { label: "Vencido", value: "R$ 480", icon: "!", hint: "2 pendências" },
      { label: "Taxa de pagamento", value: "92%", icon: "✓", hint: "Dentro da meta" },
    ]}>
      <PremiumToolbar><label><span>Buscar</span><input placeholder="Aluno ou responsável..." /></label><label><span>Status</span><select><option>Todos</option><option>Pago</option><option>Pendente</option><option>Vencido</option></select></label><label><span>Competência</span><select><option>Setembro 2026</option></select></label><button className="premium-filter-button">⌕ Filtrar</button></PremiumToolbar>
      <PremiumPanel title="Movimentações recentes" subtitle="Cobranças e recebimentos da plataforma">
        <div className="premium-table-wrap"><table className="premium-table"><thead><tr><th>Aluno</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>
          <tr><td><strong>Ana Clara</strong></td><td>Pacote mensal</td><td>10/09/2026</td><td>R$ 420,00</td><td><span className="premium-status">Pago</span></td></tr>
          <tr><td><strong>Bruno Lima</strong></td><td>Aulas de Matemática</td><td>12/09/2026</td><td>R$ 360,00</td><td><span className="premium-status premium-status-warn">Pendente</span></td></tr>
          <tr><td><strong>Camila Rocha</strong></td><td>Pacote mensal</td><td>05/09/2026</td><td>R$ 240,00</td><td><span className="premium-status premium-status-danger">Vencido</span></td></tr>
        </tbody></table></div>
      </PremiumPanel>
    </PremiumPage>
  );
}
