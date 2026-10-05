"use client";

import { useState } from "react";

type Props = {
  bookingId: string;
  amount: string;
  currentStatus: "pending" | "paid";
  currentMethod?: string | null;
  currentPaidAt?: string | null;
  currentNote?: string | null;
  action: (formData: FormData) => void | Promise<void>;
};

function localDateTime(value?: string | null) {
  if (!value) {
    const d = new Date();
    const pad = (n:number) => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const d = new Date(value);
  const pad = (n:number) => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPaymentButton({ bookingId, amount, currentStatus, currentMethod, currentPaidAt, currentNote, action }: Props) {
  const [open, setOpen] = useState(false);
  if (currentStatus === "paid") {
    return <form action={action}><input type="hidden" name="booking_id" value={bookingId}/><input type="hidden" name="payment_status" value="pending"/><button className="premium-filter-button" type="submit">Marcar pendente</button></form>;
  }
  return <>
    <button className="premium-filter-button" type="button" onClick={() => setOpen(true)}>Marcar pago</button>
    {open && <div className="payment-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby={`pay-${bookingId}`}>
        <div className="payment-modal-header"><div><span className="payment-modal-kicker">Confirmação financeira</span><h2 id={`pay-${bookingId}`}>Registrar pagamento</h2></div><button type="button" className="payment-modal-close" aria-label="Fechar" onClick={()=>setOpen(false)}>×</button></div>
        <div className="payment-modal-amount">{amount}</div>
        <form action={action} className="payment-admin-form">
          <input type="hidden" name="booking_id" value={bookingId}/><input type="hidden" name="payment_status" value="paid"/>
          <label><span>Forma de pagamento</span><select name="payment_method" defaultValue={currentMethod || "pix"} required><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
          <label><span>Data e hora do pagamento</span><input name="paid_at" type="datetime-local" defaultValue={localDateTime(currentPaidAt)} required/></label>
          <label className="payment-admin-note"><span>Observação</span><textarea name="payment_note" rows={3} maxLength={500} defaultValue={currentNote || ""} placeholder="Ex.: comprovante conferido, pagamento recebido no financeiro..."/></label>
          <div className="payment-admin-actions"><button type="button" className="payment-secondary-button" onClick={()=>setOpen(false)}>Cancelar</button><button type="submit" className="premium-filter-button">Confirmar pagamento</button></div>
        </form>
      </section>
    </div>}
  </>;
}
