import type { ReactNode } from "react";

type Metric = {
  label: string;
  value: string;
  hint?: string;
  icon: string;
};

type PremiumPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  metrics: Metric[];
  children: ReactNode;
};

export default function PremiumPage({
  eyebrow,
  title,
  description,
  actionLabel,
  metrics,
  children,
}: PremiumPageProps) {
  return (
    <div className="premium-page">
      <section className="premium-page-head">
        <div>
          <p className="premium-breadcrumb"><span>{eyebrow.slice(0, 1)}</span>{eyebrow}</p>
          <h1>{title}</h1>
          <p className="premium-page-description">{description}</p>
        </div>
        {actionLabel && (
          <button type="button" className="premium-primary-button">
            <span>＋</span>{actionLabel}
          </button>
        )}
      </section>

      <section className="premium-hero-strip" aria-hidden="true">
        <div>
          <span>GESTÃO INTELIGENTE</span>
          <strong>Informação clara para uma rotina mais simples.</strong>
        </div>
        <div className="premium-hero-orb">✦</div>
      </section>

      <section className="premium-metric-grid">
        {metrics.map((metric) => (
          <article className="premium-metric" key={metric.label}>
            <div className="premium-metric-icon">{metric.icon}</div>
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
            <small>{metric.hint || "Atualizado agora"}</small>
          </article>
        ))}
      </section>

      {children}
    </div>
  );
}

export function PremiumToolbar({ children }: { children: ReactNode }) {
  return <section className="premium-toolbar">{children}</section>;
}

export function PremiumPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="premium-panel">
      <header className="premium-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="premium-more">•••</button>
      </header>
      {children}
    </section>
  );
}
