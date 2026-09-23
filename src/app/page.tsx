import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import "./landing.css";

export const metadata: Metadata = {
  title: "Escola Conecta | Aprender fica mais fácil quando você tem apoio",
  description: "Conheça a Escola Conecta: aulas particulares personalizadas com professores experientes. Ensino fundamental, médio e superior.",
};

const levels = [
  { number: "01", title: "Fundamental I", text: "Base sólida, confiança e acompanhamento em cada descoberta." },
  { number: "02", title: "Fundamental II", text: "Apoio para avançar nas disciplinas e superar dificuldades." },
  { number: "03", title: "Ensino Médio", text: "Preparação consistente para provas, vestibulares e novos desafios." },
  { number: "04", title: "Ensino Superior", text: "Orientação para conteúdos avançados, incluindo matemática e cálculo." },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Escola Conecta, início">
          <Image src="/clina-logo.png" alt="Logomarca da Escola Conecta" width={62} height={62} className="landing-logo" priority />
          <span><strong>Escola Conecta</strong><small>AULAS PARTICULARES</small></span>
        </Link>
        <nav aria-label="Menu principal" className="landing-nav">
          <a href="#sobre">Sobre</a><a href="#professores">Professores</a><a href="#ensino">Ensino</a><a href="#como-funciona">Como funciona</a>
        </nav>
        <Link href="/login" className="landing-login">Acessar plataforma <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="landing-hero">
        <div className="landing-glow" aria-hidden="true" />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><span className="landing-dot" /> UMA NOVA FORMA DE APRENDER</span>
            <h1>O conhecimento abre portas. <em>O apoio certo transforma caminhos.</em></h1>
            <p>Aulas particulares que respeitam o seu ritmo, com professores experientes, atenção individual e uma rotina de aprendizagem mais simples.</p>
            <div className="landing-actions"><a className="landing-primary" href="#professores">Conheça nossos professores <span aria-hidden="true">→</span></a><Link className="landing-secondary" href="/login">Já sou aluno ou professor <span aria-hidden="true">↗</span></Link></div>
            <div className="landing-hero-foot"><div className="landing-foot-icon">✦</div><span>Ensino fundamental, médio e superior<br/><strong>Uma experiência pensada para você.</strong></span></div>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-image-frame"><Image src="/eliane-retrato.jpg" alt="Professora Eliane Alves" fill sizes="(max-width: 850px) 90vw, 42vw" className="landing-hero-photo" priority /></div>
            <div className="landing-photo-card"><span className="landing-card-icon">✳</span><div><strong>18 anos de experiência</strong><span>Ensinar é acompanhar cada conquista.</span></div></div>
            <span className="landing-deco-star" aria-hidden="true">✳</span>
          </div>
        </div>
      </section>

      <section className="landing-strip" aria-label="Diferenciais"><div className="landing-container landing-strip-inner"><span>ENSINO PERSONALIZADO</span><i /><span>PROFESSORES QUALIFICADOS</span><i /><span>AGENDA ORGANIZADA</span><i /><span>APRENDIZADO COM PROPÓSITO</span></div></section>

      <section id="sobre" className="landing-section landing-about"><div className="landing-container landing-about-grid">
        <div className="landing-section-intro"><span className="landing-kicker">A ESCOLA CONECTA</span><h2>Mais do que aulas. <em>Uma conexão com o seu potencial.</em></h2></div>
        <div className="landing-about-text"><p>Acreditamos que ninguém aprende exatamente da mesma forma. Por isso, aproximamos alunos e professores para construir uma jornada com escuta, acolhimento e orientação de verdade.</p><p>Do primeiro desafio escolar aos conteúdos mais avançados, nosso propósito é que cada aluno encontre o apoio necessário para seguir em frente com segurança.</p></div>
      </div></section>

      <section id="professores" className="landing-section landing-teacher"><div className="landing-container">
        <div className="landing-heading"><div><span className="landing-kicker">QUEM ESTÁ COM VOCÊ</span><h2>Conheça nossa <em>professora.</em></h2></div><p>Experiência e atenção individual fazem diferença em cada etapa da aprendizagem.</p></div>
        <div className="landing-teacher-card"><div className="landing-teacher-photo"><Image src="/eliane-aula.jpg" alt="Eliane Alves em uma atividade de acompanhamento individual" fill sizes="(max-width: 800px) 90vw, 45vw" /></div><div className="landing-teacher-copy"><span className="landing-pill">MATEMÁTICA E APRENDIZAGEM</span><h3>Eliane Alves</h3><p className="landing-teacher-role">Professora de Matemática</p><p>Graduada em Matemática pela UFMG e mestre pela UFSJ, com 18 anos de experiência no ensino fundamental, médio e superior.</p><div className="landing-teacher-tags"><span>UFMG</span><span>Mestrado UFSJ</span><span>18 anos de experiência</span></div><a className="landing-primary" href="#como-funciona">Saiba como começar <span aria-hidden="true">→</span></a></div></div>
        <p className="landing-expansion">Em breve, outros professores e disciplinas também poderão fazer parte desta rede.</p>
      </div></section>

      <section id="ensino" className="landing-section landing-levels"><div className="landing-container"><div className="landing-heading"><div><span className="landing-kicker">CADA FASE IMPORTA</span><h2>Apoio em todos os <em>momentos de aprender.</em></h2></div><p>Um espaço para encontrar a orientação adequada ao nível de ensino e à disciplina desejada.</p></div><div className="landing-level-grid">{levels.map(level=><article className="landing-level" key={level.number}><span>{level.number} / 04</span><div className="landing-level-symbol" aria-hidden="true">✳</div><h3>{level.title}</h3><p>{level.text}</p></article>)}</div></div></section>

      <section id="como-funciona" className="landing-section landing-steps"><div className="landing-container landing-steps-grid"><div><span className="landing-kicker">SIMPLES DO COMEÇO AO FIM</span><h2>Seu próximo passo começa <em>aqui.</em></h2><p>Uma plataforma criada para conectar pessoas e deixar a organização das aulas mais prática para todos.</p><Link className="landing-primary" href="/login">Acessar minha área <span aria-hidden="true">→</span></Link></div><div className="landing-step-list"><div><span>01</span><div><h3>Acesse a plataforma</h3><p>Entre em sua área para organizar sua experiência de aprendizagem.</p></div></div><div><span>02</span><div><h3>Encontre o professor e a disciplina</h3><p>Consulte as opções de ensino e o atendimento disponível.</p></div></div><div><span>03</span><div><h3>Organize suas aulas</h3><p>Acompanhe seus horários e mantenha sua rotina em um só lugar.</p></div></div></div></div></section>

      <section className="landing-final"><div className="landing-container landing-final-inner"><span className="landing-kicker">É HORA DE COMEÇAR</span><h2>Aprender fica mais fácil quando <em>você tem apoio.</em></h2><p>Faça parte de uma experiência de ensino mais próxima, humana e organizada.</p><Link className="landing-final-button" href="/login">Entrar na Escola Conecta <span aria-hidden="true">↗</span></Link></div></section>
      <footer className="landing-footer"><div className="landing-container landing-footer-inner"><span><strong>Escola Conecta</strong> · Aulas particulares</span><span>Educação que aproxima. © {new Date().getFullYear()}</span><Link href="/login">Área de acesso ↗</Link></div></footer>
    </main>
  );
}
