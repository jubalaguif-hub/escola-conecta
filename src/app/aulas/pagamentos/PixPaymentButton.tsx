"use client";

import { useState } from "react";

type Props = {
  amount: string;
  teacher: string;
  subject: string;
  lessonDate: string;
  pixKey: string;
  pixReceiver: string;
};

export default function PixPaymentButton({ amount, teacher, subject, lessonDate, pixKey, pixReceiver }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPix() {
    if (!pixKey) return;
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.createElement("textarea");
      el.value = pixKey;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <>
      <button type="button" className="premium-filter-button" onClick={() => setOpen(true)}>
        Pagar com PIX
      </button>
      {open && (
        <div className="payment-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="pix-title">
            <div className="payment-modal-header">
              <div>
                <span className="payment-modal-kicker">Pagamento da aula</span>
                <h2 id="pix-title">Pagar com PIX</h2>
              </div>
              <button className="payment-modal-close" type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
            </div>

            <div className="payment-modal-amount">{amount}</div>
            <dl className="payment-modal-details">
              <div><dt>Professor</dt><dd>{teacher}</dd></div>
              <div><dt>Aula</dt><dd>{subject}</dd></div>
              <div><dt>Data</dt><dd>{lessonDate}</dd></div>
            </dl>

            {pixKey ? (
              <div className="payment-pix-box">
                <span>Chave PIX</span>
                <strong>{pixKey}</strong>
                {pixReceiver && <small>Favorecido: {pixReceiver}</small>}
                <button type="button" className="payment-copy-button" onClick={copyPix}>{copied ? "Chave copiada ✓" : "Copiar chave PIX"}</button>
              </div>
            ) : (
              <div className="payment-pix-warning">
                A chave PIX da escola ainda não foi configurada. Entre em contato com o financeiro para realizar o pagamento.
              </div>
            )}

            <p className="payment-modal-note">
              Após realizar o PIX, o pagamento permanecerá como <strong>Pendente</strong> até a confirmação do administrador/financeiro.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
