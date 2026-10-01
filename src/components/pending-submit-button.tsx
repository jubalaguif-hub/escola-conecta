"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export default function PendingSubmitButton({ children, pendingLabel = "Processando...", className = "", disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${className} ec-action-button ${pending ? "ec-action-pending" : ""}`.trim()}
    >
      {pending && <span className="ec-action-spinner" aria-hidden="true" />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
