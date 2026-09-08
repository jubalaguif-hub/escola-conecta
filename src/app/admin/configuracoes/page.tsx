import PremiumPage, { PremiumPanel } from "@/components/premium-page";

export default function SettingsPage() {
  return (
    <PremiumPage eyebrow="Configurações" title="Configurações da plataforma" description="Personalize dados institucionais, preferências de agenda, notificações e segurança." metrics={[
      { label: "Perfil institucional", value: "100%", icon: "✓", hint: "Cadastro completo" },
      { label: "Usuários ativos", value: "24", icon: "♙", hint: "Acessos liberados" },
      { label: "Notificações", value: "Ativas", icon: "◉", hint: "E-mail habilitado" },
      { label: "Segurança", value: "Protegido", icon: "◇", hint: "Ambiente restrito" },
    ]}>
      <div className="premium-two-columns settings-columns">
        <PremiumPanel title="Dados da escola" subtitle="Informações exibidas na plataforma">
          <div className="premium-form-grid"><label><span>Nome da instituição</span><input defaultValue="Clina Aulas Particulares" /></label><label><span>E-mail de contato</span><input defaultValue="contato@clina.com.br" /></label><label><span>Telefone</span><input placeholder="(31) 00000-0000" /></label><label><span>Fuso horário</span><select><option>Brasília (GMT-3)</option></select></label></div><button className="premium-primary-button compact">Salvar alterações</button>
        </PremiumPanel>
        <PremiumPanel title="Preferências" subtitle="Comportamento do painel administrativo">
          <div className="premium-toggle-list"><label><div><strong>Notificações de novas aulas</strong><span>Receber aviso quando uma aula for criada.</span></div><input type="checkbox" defaultChecked /></label><label><div><strong>Lembretes de cobrança</strong><span>Alertar sobre cobranças próximas do vencimento.</span></div><input type="checkbox" defaultChecked /></label><label><div><strong>Resumo semanal</strong><span>Receber um resumo da agenda toda segunda-feira.</span></div><input type="checkbox" /></label></div>
        </PremiumPanel>
      </div>
    </PremiumPage>
  );
}
